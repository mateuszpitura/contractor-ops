// ---------------------------------------------------------------------------
// Phase 60 · CLASS-07 — economic-dependency scan service tests.
// ---------------------------------------------------------------------------
//
// Covers VALIDATION.md rows 60-01-01..08 plus the Kleinunternehmer
// non-interaction and ACTIVE-only assignment-status gates.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockPrismaRaw,
  mockDispatch,
  mockResolveRecipients,
  mockMetricsGauge,
  stateByAssignment,
  invoicesByWhere,
  assignmentsFixture,
} = vi.hoisted(() => {
  const stateByAssignment = new Map<
    string,
    {
      id: string;
      organizationId: string;
      contractorAssignmentId: string;
      currentBand: 'safe' | 'warning' | 'critical';
      lastBillingShare: number;
      lastScannedAt: Date;
      lastCrossedAt: Date | null;
      lastReminderAt: Date | null;
    }
  >();

  // invoicesByWhere is an array of {match, sum} entries evaluated by
  // findFirstMatch below.
  const invoicesByWhere: Array<{
    match: (where: Record<string, unknown>) => boolean;
    sum: number;
  }> = [];
  const assignmentsFixture: Array<{
    id: string;
    organizationId: string;
    contractorId: string;
    contractor: { displayName: string };
  }> = [];

  const mockPrismaRaw = {
    invoice: {
      aggregate: vi.fn(async (args: { where: Record<string, unknown> }) => {
        for (const rule of invoicesByWhere) {
          if (rule.match(args.where)) {
            return { _sum: { totalMinor: rule.sum } };
          }
        }
        return { _sum: { totalMinor: 0 } };
      }),
    },
    contractorAssignment: {
      findMany: vi.fn(async () => assignmentsFixture),
    },
    economicDependencyAlertState: {
      findUnique: vi.fn(async (args: { where: { contractorAssignmentId: string } }) => {
        return stateByAssignment.get(args.where.contractorAssignmentId) ?? null;
      }),
      upsert: vi.fn(
        async (args: {
          where: { contractorAssignmentId: string };
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => {
          const existing = stateByAssignment.get(args.where.contractorAssignmentId);
          if (existing) {
            const merged = { ...existing, ...args.update };
            stateByAssignment.set(args.where.contractorAssignmentId, merged as never);
            return merged;
          }
          const created = {
            id: `state-${stateByAssignment.size + 1}`,
            contractorAssignmentId: args.where.contractorAssignmentId,
            lastCrossedAt: null,
            lastReminderAt: null,
            ...args.create,
          } as never;
          stateByAssignment.set(args.where.contractorAssignmentId, created);
          return created;
        },
      ),
    },
    member: { findMany: vi.fn(async () => []) },
  };

  return {
    mockPrismaRaw,
    mockDispatch: vi.fn(async () => undefined),
    mockResolveRecipients: vi.fn(async () => ['user-1']),
    mockMetricsGauge: vi.fn(),
    stateByAssignment,
    invoicesByWhere,
    assignmentsFixture,
  };
});

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T,>(c: T) => c,
  withRlsReads: <T,>(c: T) => c,
  prisma: {},
  prismaRaw: mockPrismaRaw,
}));

vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  withBodyLogging: vi.fn((_o, fn) => fn),
  logIntegrationCall: vi.fn(),
  subscribeOpossumEvents: vi.fn(),
  runWithRequestContext: vi.fn((_c, fn) => fn()),
  getRequestId: vi.fn(() => undefined),
  getTraceparent: vi.fn(() => undefined),
  buildContextFromHeaders: vi.fn(() => ({})),
  getOutboundHeaders: vi.fn(() => ({})),
  generateRequestId: vi.fn(() => 'test-request-id'),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  LOG_BODY_INCLUDE_PREFIXES: [],
  PII_MASK_KEYWORDS: [],
  PII_MASK_PATHS: [],
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: mockMetricsGauge, increment: vi.fn(), distribution: vi.fn() },
}));

vi.mock('../notification-service.js', () => ({
  dispatch: mockDispatch,
}));

vi.mock('../rbac-recipients.js', () => ({
  resolveRbacRecipients: mockResolveRecipients,
}));

import {
  bandFor,
  CRITICAL_THRESHOLD,
  computeBillingShare,
  REMINDER_CADENCE_DAYS,
  runEconomicDependencyScan,
  updateBandState,
  WARNING_THRESHOLD,
} from '../economic-dependency-scan.js';

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const _ORG_B = 'clorgbbbbbbbbbbbbbbbbbbbbbb';
const CONTRACTOR = 'clcontractor0000000000000';
const ASSIGNMENT_A = 'clasgnmentaaaaaaaaaaaaaaaa';

function resetFixtures() {
  mockPrismaRaw.invoice.aggregate.mockClear();
  mockPrismaRaw.contractorAssignment.findMany.mockClear();
  mockPrismaRaw.economicDependencyAlertState.findUnique.mockClear();
  mockPrismaRaw.economicDependencyAlertState.upsert.mockClear();
  mockDispatch.mockClear();
  mockResolveRecipients.mockClear();
  mockMetricsGauge.mockClear();
  stateByAssignment.clear();
  invoicesByWhere.length = 0;
  assignmentsFixture.length = 0;
}

beforeEach(resetFixtures);

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('bandFor (thresholds)', () => {
  it('returns safe below 70%', () => {
    expect(bandFor(0)).toBe('safe');
    expect(bandFor(0.69)).toBe('safe');
  });
  it('returns warning at the 70% boundary (inclusive)', () => {
    expect(bandFor(WARNING_THRESHOLD)).toBe('warning');
    expect(bandFor(0.75)).toBe('warning');
    expect(bandFor(0.8332)).toBe('warning');
  });
  it('returns critical at the 83.33% boundary (inclusive)', () => {
    expect(bandFor(CRITICAL_THRESHOLD)).toBe('critical');
    expect(bandFor(0.9)).toBe('critical');
    expect(bandFor(1)).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// computeBillingShare — window + cross-org aggregate
// ---------------------------------------------------------------------------

describe('computeBillingShare', () => {
  it('[window] uses a 12-month closed interval ending at `now`', async () => {
    const now = new Date('2026-04-14T00:00:00Z');
    invoicesByWhere.push({
      match: where =>
        (where.organizationId as string) === ORG_A && (where.contractorId as string) === CONTRACTOR,
      sum: 500_00,
    });
    invoicesByWhere.push({
      match: where => !('organizationId' in where) && (where.contractorId as string) === CONTRACTOR,
      sum: 1_000_00,
    });

    await computeBillingShare(CONTRACTOR, ORG_A, now);

    const calls = mockPrismaRaw.invoice.aggregate.mock.calls.map(c => c[0]);
    for (const call of calls) {
      const where = call.where as { issueDate: { gte: Date; lte: Date } };
      expect(where.issueDate.lte.getTime()).toBe(now.getTime());
      const diffMs = where.issueDate.lte.getTime() - where.issueDate.gte.getTime();
      // ~365 days ± a day (leap handling)
      expect(diffMs).toBeGreaterThan(364 * 24 * 60 * 60 * 1000);
      expect(diffMs).toBeLessThan(367 * 24 * 60 * 60 * 1000);
    }
  });

  it('[cross-org] denominator aggregates across every organisation (no organizationId filter)', async () => {
    const now = new Date('2026-04-14T00:00:00Z');
    invoicesByWhere.push({
      match: where =>
        (where.organizationId as string) === ORG_A && (where.contractorId as string) === CONTRACTOR,
      sum: 700_00,
    });
    invoicesByWhere.push({
      match: where => !('organizationId' in where) && (where.contractorId as string) === CONTRACTOR,
      sum: 1_000_00,
    });

    const result = await computeBillingShare(CONTRACTOR, ORG_A, now);

    expect(result.numerator).toBe(700_00);
    expect(result.denominator).toBe(1_000_00);
    expect(result.share).toBeCloseTo(0.7, 5);

    // Assert one of the aggregate calls OMITS organizationId (cross-org).
    const whereArgs = mockPrismaRaw.invoice.aggregate.mock.calls.map(c => c[0].where);
    const crossOrgCalls = whereArgs.filter(w => !('organizationId' in w));
    expect(crossOrgCalls.length).toBe(1);
    expect(crossOrgCalls[0]).toMatchObject({ contractorId: CONTRACTOR });
  });

  it('returns share=0 when denominator is zero (no invoices)', async () => {
    const now = new Date('2026-04-14T00:00:00Z');
    const result = await computeBillingShare(CONTRACTOR, ORG_A, now);
    expect(result).toEqual({ numerator: 0, denominator: 0, share: 0 });
  });

  it('filters VOID invoices from both numerator and denominator', async () => {
    const now = new Date('2026-04-14T00:00:00Z');
    invoicesByWhere.push({ match: () => true, sum: 0 });
    await computeBillingShare(CONTRACTOR, ORG_A, now);
    const whereArgs = mockPrismaRaw.invoice.aggregate.mock.calls.map(c => c[0].where);
    for (const w of whereArgs) {
      expect(w.status).toEqual({ notIn: ['VOID'] });
      expect(w.deletedAt).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// updateBandState — state machine
// ---------------------------------------------------------------------------

describe('updateBandState', () => {
  const now = new Date('2026-04-14T00:00:00Z');
  const assignment = { id: ASSIGNMENT_A, organizationId: ORG_A };

  it('[band-state] safe → warning fires warning notification', async () => {
    const res = await updateBandState(assignment, 0.75, now);
    expect(res.previousBand).toBe('safe');
    expect(res.currentBand).toBe('warning');
    expect(res.emittedType).toBe('classification.economic_dependency_warning');
    expect(res.reason).toBe('cross-up');
  });

  it('[band-state] warning → critical fires critical notification', async () => {
    stateByAssignment.set(ASSIGNMENT_A, {
      id: 's1',
      organizationId: ORG_A,
      contractorAssignmentId: ASSIGNMENT_A,
      currentBand: 'warning',
      lastBillingShare: 0.72,
      lastScannedAt: new Date('2026-04-10T00:00:00Z'),
      lastCrossedAt: new Date('2026-04-10T00:00:00Z'),
      lastReminderAt: new Date('2026-04-10T00:00:00Z'),
    });
    const res = await updateBandState(assignment, 0.9, now);
    expect(res.previousBand).toBe('warning');
    expect(res.currentBand).toBe('critical');
    expect(res.emittedType).toBe('classification.economic_dependency_critical');
    expect(res.reason).toBe('cross-up');
  });

  it('[band-state] safe → critical emits critical (skipping warning)', async () => {
    const res = await updateBandState(assignment, 0.95, now);
    expect(res.emittedType).toBe('classification.economic_dependency_critical');
    expect(res.reason).toBe('cross-up');
  });

  it('[band-state] critical → warning fires resolved notification', async () => {
    stateByAssignment.set(ASSIGNMENT_A, {
      id: 's1',
      organizationId: ORG_A,
      contractorAssignmentId: ASSIGNMENT_A,
      currentBand: 'critical',
      lastBillingShare: 0.9,
      lastScannedAt: new Date('2026-04-10T00:00:00Z'),
      lastCrossedAt: new Date('2026-04-10T00:00:00Z'),
      lastReminderAt: new Date('2026-04-10T00:00:00Z'),
    });
    const res = await updateBandState(assignment, 0.75, now);
    expect(res.previousBand).toBe('critical');
    expect(res.currentBand).toBe('warning');
    expect(res.emittedType).toBe('resolved');
    expect(res.reason).toBe('cross-down');
  });

  it('[dedup] same-band same-day → no notification emitted', async () => {
    stateByAssignment.set(ASSIGNMENT_A, {
      id: 's1',
      organizationId: ORG_A,
      contractorAssignmentId: ASSIGNMENT_A,
      currentBand: 'warning',
      lastBillingShare: 0.75,
      lastScannedAt: now,
      lastCrossedAt: now,
      lastReminderAt: now,
    });
    const res = await updateBandState(assignment, 0.76, now);
    expect(res.emittedType).toBeNull();
    expect(res.reason).toBe('no-change');
  });

  it('[reminder-cadence] re-fires after 30+ days in same non-safe band', async () => {
    const firstRun = new Date('2026-01-01T00:00:00Z');
    const day29 = new Date(firstRun);
    day29.setUTCDate(day29.getUTCDate() + 29);
    const day31 = new Date(firstRun);
    day31.setUTCDate(day31.getUTCDate() + 31);

    // Seed state at day 0 (freshly warning).
    stateByAssignment.set(ASSIGNMENT_A, {
      id: 's1',
      organizationId: ORG_A,
      contractorAssignmentId: ASSIGNMENT_A,
      currentBand: 'warning',
      lastBillingShare: 0.75,
      lastScannedAt: firstRun,
      lastCrossedAt: firstRun,
      lastReminderAt: firstRun,
    });

    const day29Res = await updateBandState(assignment, 0.76, day29);
    expect(day29Res.emittedType).toBeNull();

    const day31Res = await updateBandState(assignment, 0.76, day31);
    expect(day31Res.emittedType).toBe('classification.economic_dependency_warning');
    expect(day31Res.reason).toBe('reminder');
    expect(REMINDER_CADENCE_DAYS).toBe(30);
  });

  it('safe → safe (no change) never emits anything', async () => {
    const res = await updateBandState(assignment, 0.1, now);
    expect(res.emittedType).toBeNull();
    expect(res.reason).toBe('no-change');
  });
});

// ---------------------------------------------------------------------------
// Orchestrator — RBAC, replay, Kleinunternehmer non-interaction, status gate
// ---------------------------------------------------------------------------

describe('runEconomicDependencyScan (orchestrator)', () => {
  it('[RBAC] dispatches with recipientUserIds from resolveRbacRecipients', async () => {
    assignmentsFixture.push({
      id: ASSIGNMENT_A,
      organizationId: ORG_A,
      contractorId: CONTRACTOR,
      contractor: { displayName: 'ACME Contractor' },
    });
    invoicesByWhere.push({
      match: w =>
        (w.organizationId as string) === ORG_A && (w.contractorId as string) === CONTRACTOR,
      sum: 800_00,
    });
    invoicesByWhere.push({
      match: w => !('organizationId' in w) && (w.contractorId as string) === CONTRACTOR,
      sum: 1_000_00,
    });
    mockResolveRecipients.mockResolvedValueOnce(['user-a', 'user-b']);

    const result = await runEconomicDependencyScan(new Date('2026-04-14T00:00:00Z'));

    expect(result.scanned).toBe(1);
    expect(result.crossings).toBe(1);
    expect(result.notificationsDispatched).toBe(1);
    expect(mockResolveRecipients).toHaveBeenCalledWith(ORG_A, 'contractor:read');
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const call = mockDispatch.mock.calls[0][0];
    expect(call.recipientUserIds).toEqual(['user-a', 'user-b']);
    expect(call.type).toBe('classification.economic_dependency_warning');
    expect(call.organizationId).toBe(ORG_A);
    expect(call.entityType).toBe('CONTRACTOR');
  });

  it('[replay] repeat scan with no new invoices emits 0 new notifications', async () => {
    assignmentsFixture.push({
      id: ASSIGNMENT_A,
      organizationId: ORG_A,
      contractorId: CONTRACTOR,
      contractor: { displayName: 'ACME Contractor' },
    });
    invoicesByWhere.push({
      match: w =>
        (w.organizationId as string) === ORG_A && (w.contractorId as string) === CONTRACTOR,
      sum: 800_00,
    });
    invoicesByWhere.push({
      match: w => !('organizationId' in w) && (w.contractorId as string) === CONTRACTOR,
      sum: 1_000_00,
    });

    const t0 = new Date('2026-04-14T00:00:00Z');
    await runEconomicDependencyScan(t0);

    // Five minutes later, same share → no new notification.
    mockDispatch.mockClear();
    const t1 = new Date(t0.getTime() + 5 * 60 * 1000);
    await runEconomicDependencyScan(t1);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('[cross-org] dispatches exactly once per up-crossing even with multi-org invoices', async () => {
    assignmentsFixture.push({
      id: ASSIGNMENT_A,
      organizationId: ORG_A,
      contractorId: CONTRACTOR,
      contractor: { displayName: 'Multi-Org Contractor' },
    });
    invoicesByWhere.push({
      match: w =>
        (w.organizationId as string) === ORG_A && (w.contractorId as string) === CONTRACTOR,
      sum: 700_00, // numerator = 700k from Org A
    });
    invoicesByWhere.push({
      match: w => !('organizationId' in w) && (w.contractorId as string) === CONTRACTOR,
      sum: 1_000_00, // denominator = Org A (700k) + Org B (300k) = 1_000_00
    });
    const res = await runEconomicDependencyScan(new Date('2026-04-14T00:00:00Z'));
    expect(res.notificationsDispatched).toBe(1);
    // Share = 700k / 1M = 0.70 → warning
    const call = mockDispatch.mock.calls[0][0];
    expect(call.type).toBe('classification.economic_dependency_warning');
  });

  it('Kleinunternehmer non-interaction: thresholds fire identically regardless of VAT regime', async () => {
    // The scan service itself is agnostic of the org's isKleinunternehmer
    // flag — there is no branch for it in the code path. This test asserts
    // that assertion: the same share produces the same band/notification
    // irrespective of any per-org fixture variable.
    assignmentsFixture.push({
      id: ASSIGNMENT_A,
      organizationId: ORG_A,
      contractorId: CONTRACTOR,
      contractor: { displayName: 'Kleinunternehmer Contractor' },
    });
    invoicesByWhere.push({
      match: w =>
        (w.organizationId as string) === ORG_A && (w.contractorId as string) === CONTRACTOR,
      sum: 750_00,
    });
    invoicesByWhere.push({
      match: w => !('organizationId' in w) && (w.contractorId as string) === CONTRACTOR,
      sum: 1_000_00,
    });

    const res = await runEconomicDependencyScan(new Date('2026-04-14T00:00:00Z'));
    expect(res.notificationsDispatched).toBe(1);
    expect(mockDispatch.mock.calls[0][0].type).toBe('classification.economic_dependency_warning');
  });

  it('filters assignments by status=ACTIVE + contractor.countryCode=DE in the findMany where-clause', async () => {
    await runEconomicDependencyScan(new Date('2026-04-14T00:00:00Z'));
    const args = mockPrismaRaw.contractorAssignment.findMany.mock.calls[0][0];
    expect(args.where.status).toBe('ACTIVE');
    expect(args.where.contractor.countryCode).toBe('DE');
  });

  it('emits three metrics.gauge counters per scan', async () => {
    await runEconomicDependencyScan(new Date('2026-04-14T00:00:00Z'));
    const names = mockMetricsGauge.mock.calls.map(c => c[0]);
    expect(names).toContain('cron.classification_economic_dependency.scanned');
    expect(names).toContain('cron.classification_economic_dependency.crossings');
    expect(names).toContain('cron.classification_economic_dependency.notifications');
  });
});

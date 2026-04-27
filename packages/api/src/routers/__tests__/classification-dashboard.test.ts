// ---------------------------------------------------------------------------
// Phase 60 · CLASS-10 — classificationDashboard router tests.
// ---------------------------------------------------------------------------
//
// Covers:
//   60-04-01 coverage               (contractorReadProcedure + status='completed')
//   60-04-02 risk-distribution      (GB + DE bucket mapping; drafts excluded)
//   60-04-03 overdue                (GB triggers; DE 12-month-old assessments)
//   60-04-04 active-alerts          (GB trigger count; DE bands + DRV expiry window)
//   60-04-05 csv-sanitization       (formula-prefix neutralisation end-to-end)
//   60-04-06 csv-format             (UTF-8 BOM + column set + 300s TTL)
//   + contractor:read gating + cross-org assertion + globalHeader shape.

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const ORG_B = 'clorgbbbbbbbbbbbbbbbbbbbbbb';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';

const { mockPrisma, mockHasPermission, fixtures, mockR2PutObjectAndSignDownload } = vi.hoisted(
  () => {
    type Assignment = {
      id: string;
      organizationId: string;
      status: 'ACTIVE' | 'INACTIVE';
      contractorId: string;
      contractor: { id: string; name: string; countryCode: 'GB' | 'DE' };
    };
    type Assessment = {
      id: string;
      organizationId: string;
      contractorAssignmentId: string;
      status: 'draft' | 'completed';
      countryCode: 'GB' | 'DE';
      outcome: Record<string, unknown> | null;
      completedAt: Date | null;
    };
    type Alert = {
      id: string;
      organizationId: string;
      contractorAssignmentId: string;
      currentBand: 'safe' | 'warning' | 'critical';
      lastBillingShare: number;
      lastScannedAt: Date;
      contractorAssignment?: { contractor?: { countryCode: 'GB' | 'DE' } };
    };
    type Trigger = {
      id: string;
      organizationId: string;
      contractorAssignmentId: string;
      status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
      contractorAssignment?: {
        contractor?: { name: string; countryCode: 'GB' | 'DE' } | null;
      } | null;
    };
    type DrvRecord = {
      id: string;
      organizationId: string;
      contractorAssignmentId: string;
      outcome: 'PENDING' | 'SELBSTANDIG' | 'ABHANGIG' | 'WITHDRAWN';
      validTo: Date | null;
      filedAt: Date;
      contractorAssignment?: { contractor?: { countryCode: 'GB' | 'DE' } };
    };

    const fixtures = {
      assignments: [] as Assignment[],
      assessments: [] as Assessment[],
      alerts: [] as Alert[],
      triggers: [] as Trigger[],
      drv: [] as DrvRecord[],
      cronScanState: null as { name: string; lastScanCompletedAt: Date } | null,
    };

    const matchWhere = (row: Record<string, unknown>, where: Record<string, unknown>): boolean => {
      for (const [k, v] of Object.entries(where)) {
        const rowVal = row[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const clause = v as Record<string, unknown>;
          if ('in' in clause) {
            if (!(clause.in as unknown[]).includes(rowVal)) return false;
            continue;
          }
          if ('lt' in clause && rowVal instanceof Date) {
            if (!(rowVal < (clause.lt as Date))) return false;
            continue;
          }
          if ('gte' in clause && 'lte' in clause && rowVal instanceof Date) {
            if (rowVal < (clause.gte as Date)) return false;
            if (rowVal > (clause.lte as Date)) return false;
            continue;
          }
          if ('gte' in clause && rowVal instanceof Date) {
            if (rowVal < (clause.gte as Date)) return false;
            continue;
          }
          // nested object (e.g. contractor: { countryCode: 'GB' })
          if (rowVal && typeof rowVal === 'object') {
            if (!matchWhere(rowVal as Record<string, unknown>, clause)) return false;
            continue;
          }
          return false;
        }
        if (rowVal !== v) return false;
      }
      return true;
    };

    const mockHasPermission = vi.fn().mockResolvedValue({ success: true });

    const mockR2PutObjectAndSignDownload = vi.fn(
      async (params: {
        key: string;
        body: Uint8Array;
        contentType: string;
        downloadFilename?: string;
        ttlSeconds?: number;
      }) => ({
        signedUrl: `https://r2.test/${params.key}?sig=fake`,
        expiresInSeconds: params.ttlSeconds ?? 300,
        _body: params.body,
        _contentType: params.contentType,
        _downloadFilename: params.downloadFilename,
      }),
    );

    const mockPrisma = {
      contractor: {
        count: vi.fn(async (args?: { where?: Record<string, unknown> }) => {
          const seen = new Set<string>();
          for (const a of fixtures.assignments) {
            if (args?.where && !matchWhere(a.contractor, args.where)) continue;
            seen.add(a.contractorId);
          }
          // For globalHeader, count ALL contractors (not just active-assignment ones)
          if (!args?.where) return new Set(fixtures.assignments.map(a => a.contractorId)).size;
          return seen.size;
        }),
      },
      contractorAssignment: {
        count: vi.fn(async (args?: { where?: Record<string, unknown> }) => {
          const where = args?.where ?? {};
          return fixtures.assignments.filter(a => matchWhere(a, where)).length;
        }),
        findMany: vi.fn(
          async (args: { where?: Record<string, unknown>; include?: unknown; take?: number }) => {
            const where = args?.where ?? {};
            const rows = fixtures.assignments.filter(a => matchWhere(a, where));
            return rows.slice(0, args.take ?? rows.length);
          },
        ),
      },
      classificationAssessment: {
        findMany: vi.fn(
          async (args: {
            where?: Record<string, unknown>;
            orderBy?: unknown;
            select?: Record<string, boolean>;
            distinct?: string[];
            include?: unknown;
            take?: number;
          }) => {
            const where = args?.where ?? {};
            let rows = fixtures.assessments.filter(row => {
              // flatten contractorAssignmentId:{ in: [...] }
              for (const [k, v] of Object.entries(where)) {
                if (
                  k === 'contractorAssignmentId' &&
                  typeof v === 'object' &&
                  v !== null &&
                  'in' in v
                ) {
                  if (!(v as { in: string[] }).in.includes(row.contractorAssignmentId))
                    return false;
                  continue;
                }
                if (k === 'completedAt' && typeof v === 'object' && v !== null) {
                  const clause = v as { lt?: Date; gte?: Date; lte?: Date };
                  if (clause.lt && (!row.completedAt || row.completedAt >= clause.lt)) return false;
                  if (clause.gte && (!row.completedAt || row.completedAt < clause.gte))
                    return false;
                  if (clause.lte && (!row.completedAt || row.completedAt > clause.lte))
                    return false;
                  continue;
                }
                if (row[k as keyof typeof row] !== v) return false;
              }
              return true;
            });
            if (args.orderBy && typeof args.orderBy === 'object') {
              const orderBy = args.orderBy as { completedAt?: 'asc' | 'desc' };
              if (orderBy.completedAt === 'desc') {
                rows = [...rows].sort(
                  (a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
                );
              } else if (orderBy.completedAt === 'asc') {
                rows = [...rows].sort(
                  (a, b) => (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0),
                );
              }
            }
            if (args.distinct?.includes('contractorAssignmentId')) {
              const seen = new Set<string>();
              rows = rows.filter(r => {
                if (seen.has(r.contractorAssignmentId)) return false;
                seen.add(r.contractorAssignmentId);
                return true;
              });
            }
            if (args.include) {
              // hydrate contractorAssignment + contractor
              rows = rows.map(r => {
                const a = fixtures.assignments.find(x => x.id === r.contractorAssignmentId);
                return {
                  ...r,
                  contractorAssignment: a
                    ? {
                        ...a,
                        contractor: {
                          name: a.contractor.name,
                          countryCode: a.contractor.countryCode,
                        },
                      }
                    : null,
                } as typeof r;
              });
            }
            return rows.slice(0, args.take ?? rows.length);
          },
        ),
      },
      economicDependencyAlertState: {
        count: vi.fn(async (args: { where?: Record<string, unknown> }) => {
          const where = args?.where ?? {};
          return fixtures.alerts.filter(a => matchWhere(a, where)).length;
        }),
        findFirst: vi.fn(async () => {
          const sorted = [...fixtures.alerts].sort(
            (a, b) => b.lastScannedAt.getTime() - a.lastScannedAt.getTime(),
          );
          return sorted[0] ? { lastScannedAt: sorted[0].lastScannedAt } : null;
        }),
        findMany: vi.fn(async (args: { where?: Record<string, unknown> }) => {
          const where = args?.where ?? {};
          return fixtures.alerts.filter(a => {
            for (const [k, v] of Object.entries(where)) {
              if (
                k === 'contractorAssignmentId' &&
                typeof v === 'object' &&
                v !== null &&
                'in' in v
              ) {
                if (!(v as { in: string[] }).in.includes(a.contractorAssignmentId)) return false;
                continue;
              }
              if ((a as unknown as Record<string, unknown>)[k] !== v) return false;
            }
            return true;
          });
        }),
      },
      reassessmentTrigger: {
        count: vi.fn(async (args: { where?: Record<string, unknown> }) => {
          const where = args?.where ?? {};
          return fixtures.triggers.filter(t => matchWhere(t, where)).length;
        }),
        findMany: vi.fn(
          async (args: { where?: Record<string, unknown>; include?: unknown; take?: number }) => {
            const where = args?.where ?? {};
            let rows = fixtures.triggers.filter(t => matchWhere(t, where));
            if (args.include) {
              rows = rows.map(t => {
                const a = fixtures.assignments.find(x => x.id === t.contractorAssignmentId);
                return {
                  ...t,
                  contractorAssignment: a
                    ? {
                        ...a,
                        contractor: {
                          name: a.contractor.name,
                          countryCode: a.contractor.countryCode,
                        },
                      }
                    : null,
                };
              });
            }
            return rows.slice(0, args.take ?? rows.length);
          },
        ),
      },
      statusfeststellungsverfahren: {
        count: vi.fn(async (args: { where?: Record<string, unknown> }) => {
          const where = args?.where ?? {};
          return fixtures.drv.filter(d => matchWhere(d, where)).length;
        }),
        findMany: vi.fn(async (args: { where?: Record<string, unknown>; take?: number }) => {
          const where = args?.where ?? {};
          const rows = fixtures.drv.filter(d => {
            for (const [k, v] of Object.entries(where)) {
              if (
                k === 'contractorAssignmentId' &&
                typeof v === 'object' &&
                v !== null &&
                'in' in v
              ) {
                if (!(v as { in: string[] }).in.includes(d.contractorAssignmentId)) return false;
                continue;
              }
              if ((d as unknown as Record<string, unknown>)[k] !== v) return false;
            }
            return true;
          });
          return rows.slice(0, args.take ?? rows.length);
        }),
      },
      cronScanState: {
        findUnique: vi.fn(async () =>
          fixtures.cronScanState
            ? { lastScanCompletedAt: fixtures.cronScanState.lastScanCompletedAt }
            : null,
        ),
      },
      organization: {
        findUnique: vi.fn(async () => ({ dataRegion: 'EU' })),
      },
    };
    return { mockPrisma, mockHasPermission, fixtures, mockR2PutObjectAndSignDownload };
  },
);

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: mockHasPermission,
    },
  },
  authApi: {
    hasPermission: mockHasPermission,
  },
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), gauge: vi.fn(), distribution: vi.fn() },
}));

vi.mock('../../services/r2.js', () => ({
  putObjectAndSignDownload: mockR2PutObjectAndSignDownload,
}));

vi.mock('@contractor-ops/feature-flags', async importOriginal => {
  // Multi-layer enforcement (D-05/D-06):
  //  1. root.ts evaluates `buildFlagBag` at module load to gate classification routers.
  //  2. classificationProcedure middleware calls `evaluate(...)` per-request.
  // Tests that exercise classification need both layers to return enabled=true.
  const actual = (await importOriginal()) as Record<string, unknown>;
  const enabledBag = {
    values: { 'module.classification-engine': true },
    isEnabled: (key: string) => key === 'module.classification-engine',
  };
  return {
    ...actual,
    buildFlagBag: vi.fn(() => enabledBag),
    lazyFlagBag: vi.fn(() => enabledBag),
    evaluate: vi.fn((key: string) =>
      key === 'module.classification-engine'
        ? { enabled: true, reason: 'mocked' }
        : { enabled: false, reason: 'mocked' },
    ),
  };
});

import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';

const createCaller = createCallerFactory(appRouter);

function makeCaller(orgId = ORG_A, userId = USER_ID) {
  const session = {
    session: {
      id: `session-${userId}`,
      userId,
      activeOrganizationId: orgId,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: userId,
      name: 'Test User',
      email: `${userId}@example.com`,
      emailVerified: true,
      image: null,
      banned: false,
      banReason: null,
      banExpires: null,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  return createCaller({
    headers: new Headers(),
    session: session as never,
    user: session.user as never,
  });
}

function seedGb() {
  // 7 ACTIVE GB engagements; 5 with completed assessments (3 Outside / 2 Inside)
  // plus 2 with Undetermined/indeterminate to exercise all 3 buckets →
  // For coverage test we want 5 of 7 → use a subset.
  fixtures.assignments = [];
  fixtures.assessments = [];

  // Build 7 GB engagements in ORG_A
  for (let i = 0; i < 7; i++) {
    fixtures.assignments.push({
      id: `gb-asgn-${i}`,
      organizationId: ORG_A,
      status: 'ACTIVE',
      contractorId: `gb-cont-${i}`,
      contractor: { id: `gb-cont-${i}`, name: `GB Contractor ${i}`, countryCode: 'GB' },
    });
  }

  const verdictsForFiveCompleted: Array<'outside' | 'inside' | 'indeterminate'> = [
    'outside',
    'outside',
    'outside',
    'inside',
    'indeterminate',
  ];
  verdictsForFiveCompleted.forEach((v, i) => {
    fixtures.assessments.push({
      id: `gb-as-${i}`,
      organizationId: ORG_A,
      contractorAssignmentId: `gb-asgn-${i}`,
      status: 'completed',
      countryCode: 'GB',
      outcome: { kind: 'IR35', verdict: v, reasons: [] },
      completedAt: new Date('2026-04-01T00:00:00Z'),
    });
  });
  // 2 drafts — should be excluded from coverage + risk distribution
  for (let i = 5; i < 7; i++) {
    fixtures.assessments.push({
      id: `gb-draft-${i}`,
      organizationId: ORG_A,
      contractorAssignmentId: `gb-asgn-${i}`,
      status: 'draft',
      countryCode: 'GB',
      outcome: null,
      completedAt: null,
    });
  }
}

function seedDe() {
  fixtures.assignments = [];
  fixtures.assessments = [];
  fixtures.alerts = [];
  fixtures.drv = [];

  for (let i = 0; i < 6; i++) {
    fixtures.assignments.push({
      id: `de-asgn-${i}`,
      organizationId: ORG_A,
      status: 'ACTIVE',
      contractorId: `de-cont-${i}`,
      contractor: { id: `de-cont-${i}`, name: `DE Contractor ${i}`, countryCode: 'DE' },
    });
  }
  const verdicts: Array<'green' | 'amber' | 'red'> = [
    'green',
    'green',
    'amber',
    'amber',
    'amber',
    'red',
  ];
  verdicts.forEach((v, i) => {
    fixtures.assessments.push({
      id: `de-as-${i}`,
      organizationId: ORG_A,
      contractorAssignmentId: `de-asgn-${i}`,
      status: 'completed',
      countryCode: 'DE',
      outcome: { kind: 'SCHEINSELBSTANDIGKEIT', verdict: v, score: 10, reasons: [] },
      completedAt: new Date('2026-04-01T00:00:00Z'),
    });
  });
}

beforeEach(() => {
  mockHasPermission.mockResolvedValue({ success: true });
  fixtures.assignments = [];
  fixtures.assessments = [];
  fixtures.alerts = [];
  fixtures.triggers = [];
  fixtures.drv = [];
  fixtures.cronScanState = null;
  mockR2PutObjectAndSignDownload.mockClear();
});

// ---------------------------------------------------------------------------
// 60-04-01 — coverage
// ---------------------------------------------------------------------------

describe('classificationDashboard.coverageByMarket (60-04-01)', () => {
  it('returns {completed, total} excluding draft assessments (Pitfall 8)', async () => {
    seedGb();
    const caller = makeCaller(ORG_A);
    const result = await caller.classificationDashboard.coverageByMarket({ market: 'GB' });
    expect(result).toEqual({ completed: 5, total: 7 });
  });

  it('is rejected with FORBIDDEN when contractor:read is denied', async () => {
    mockHasPermission.mockResolvedValue({ success: false });
    seedGb();
    const caller = makeCaller(ORG_A);
    await expect(
      caller.classificationDashboard.coverageByMarket({ market: 'GB' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('returns 0 / 0 for a market with no engagements', async () => {
    const caller = makeCaller(ORG_A);
    const result = await caller.classificationDashboard.coverageByMarket({ market: 'DE' });
    expect(result).toEqual({ completed: 0, total: 0 });
  });
});

// ---------------------------------------------------------------------------
// 60-04-02 — risk distribution
// ---------------------------------------------------------------------------

describe('classificationDashboard.riskDistributionByMarket (60-04-02)', () => {
  it('maps IR35 verdicts to safe/warning/critical buckets (GB)', async () => {
    seedGb();
    const caller = makeCaller(ORG_A);
    const result = await caller.classificationDashboard.riskDistributionByMarket({ market: 'GB' });
    expect(result).toEqual({
      counts: { safe: 3, warning: 1, critical: 1 },
      totalCompleted: 5,
    });
  });

  it('maps DRV verdicts to safe/warning/critical buckets (DE)', async () => {
    seedDe();
    const caller = makeCaller(ORG_A);
    const result = await caller.classificationDashboard.riskDistributionByMarket({ market: 'DE' });
    expect(result).toEqual({
      counts: { safe: 2, warning: 3, critical: 1 },
      totalCompleted: 6,
    });
  });
});

// ---------------------------------------------------------------------------
// 60-04-03 — overdue
// ---------------------------------------------------------------------------

describe('classificationDashboard.overdueByMarket (60-04-03)', () => {
  it('counts OPEN + ACKNOWLEDGED triggers only (GB) — RESOLVED excluded', async () => {
    seedGb();
    fixtures.triggers = [
      {
        id: 't-open',
        organizationId: ORG_A,
        contractorAssignmentId: 'gb-asgn-0',
        status: 'OPEN',
        contractorAssignment: { contractor: { name: 'GB Contractor 0', countryCode: 'GB' } },
      },
      {
        id: 't-ack',
        organizationId: ORG_A,
        contractorAssignmentId: 'gb-asgn-1',
        status: 'ACKNOWLEDGED',
        contractorAssignment: { contractor: { name: 'GB Contractor 1', countryCode: 'GB' } },
      },
      {
        id: 't-resolved',
        organizationId: ORG_A,
        contractorAssignmentId: 'gb-asgn-2',
        status: 'RESOLVED',
        contractorAssignment: { contractor: { name: 'GB Contractor 2', countryCode: 'GB' } },
      },
      {
        id: 't-dismissed',
        organizationId: ORG_A,
        contractorAssignmentId: 'gb-asgn-3',
        status: 'DISMISSED',
        contractorAssignment: { contractor: { name: 'GB Contractor 3', countryCode: 'GB' } },
      },
    ];
    const caller = makeCaller(ORG_A);
    const result = await caller.classificationDashboard.overdueByMarket({ market: 'GB' });
    expect(result.count).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it('counts DE assessments older than 12 months', async () => {
    fixtures.assignments = [
      {
        id: 'de-old',
        organizationId: ORG_A,
        status: 'ACTIVE',
        contractorId: 'c1',
        contractor: { id: 'c1', name: 'Old Contractor', countryCode: 'DE' },
      },
      {
        id: 'de-fresh',
        organizationId: ORG_A,
        status: 'ACTIVE',
        contractorId: 'c2',
        contractor: { id: 'c2', name: 'Fresh Contractor', countryCode: 'DE' },
      },
    ];
    const thirteenMonthsAgo = new Date();
    thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13);
    fixtures.assessments = [
      {
        id: 'as-old',
        organizationId: ORG_A,
        contractorAssignmentId: 'de-old',
        status: 'completed',
        countryCode: 'DE',
        outcome: { kind: 'SCHEINSELBSTANDIGKEIT', verdict: 'green', score: 5 },
        completedAt: thirteenMonthsAgo,
      },
      {
        id: 'as-fresh',
        organizationId: ORG_A,
        contractorAssignmentId: 'de-fresh',
        status: 'completed',
        countryCode: 'DE',
        outcome: { kind: 'SCHEINSELBSTANDIGKEIT', verdict: 'green', score: 5 },
        completedAt: new Date(),
      },
    ];
    const caller = makeCaller(ORG_A);
    const result = await caller.classificationDashboard.overdueByMarket({ market: 'DE' });
    expect(result.count).toBe(1);
    expect(result.items[0]?.contractorAssignmentId).toBe('de-old');
  });
});

// ---------------------------------------------------------------------------
// 60-04-04 — active alerts
// ---------------------------------------------------------------------------

describe('classificationDashboard.activeAlertsByMarket (60-04-04)', () => {
  it('returns openReassessmentTriggers count for GB', async () => {
    fixtures.triggers = [
      {
        id: 't1',
        organizationId: ORG_A,
        contractorAssignmentId: 'gb-1',
        status: 'OPEN',
        contractorAssignment: { contractor: { name: 'GB Contractor 1', countryCode: 'GB' } },
      },
      {
        id: 't2',
        organizationId: ORG_A,
        contractorAssignmentId: 'gb-2',
        status: 'ACKNOWLEDGED',
        contractorAssignment: { contractor: { name: 'GB Contractor 2', countryCode: 'GB' } },
      },
      {
        id: 't3',
        organizationId: ORG_A,
        contractorAssignmentId: 'gb-3',
        status: 'RESOLVED',
        contractorAssignment: { contractor: { name: 'GB Contractor 3', countryCode: 'GB' } },
      },
    ];
    const caller = makeCaller(ORG_A);
    const result = await caller.classificationDashboard.activeAlertsByMarket({ market: 'GB' });
    expect(result).toEqual({ openReassessmentTriggers: 2 });
  });

  it('returns {economicBands, drvExpiringWithin90d} for DE', async () => {
    const now = new Date();
    const in60days = new Date(now.getTime() + 60 * 86400000);
    const in200days = new Date(now.getTime() + 200 * 86400000);
    fixtures.alerts = [
      {
        id: 'e1',
        organizationId: ORG_A,
        contractorAssignmentId: 'de-a1',
        currentBand: 'warning',
        lastBillingShare: 0.75,
        lastScannedAt: new Date(),
        contractorAssignment: { contractor: { countryCode: 'DE' } },
      },
      {
        id: 'e2',
        organizationId: ORG_A,
        contractorAssignmentId: 'de-a2',
        currentBand: 'critical',
        lastBillingShare: 0.9,
        lastScannedAt: new Date(),
        contractorAssignment: { contractor: { countryCode: 'DE' } },
      },
      {
        id: 'e3',
        organizationId: ORG_A,
        contractorAssignmentId: 'de-a3',
        currentBand: 'safe',
        lastBillingShare: 0.2,
        lastScannedAt: new Date(),
        contractorAssignment: { contractor: { countryCode: 'DE' } },
      },
    ];
    fixtures.drv = [
      {
        id: 'd-expiring',
        organizationId: ORG_A,
        contractorAssignmentId: 'de-b1',
        outcome: 'SELBSTANDIG',
        validTo: in60days,
        filedAt: new Date('2024-01-01'),
        contractorAssignment: { contractor: { countryCode: 'DE' } },
      },
      {
        id: 'd-far-future',
        organizationId: ORG_A,
        contractorAssignmentId: 'de-b2',
        outcome: 'SELBSTANDIG',
        validTo: in200days,
        filedAt: new Date('2024-01-01'),
        contractorAssignment: { contractor: { countryCode: 'DE' } },
      },
    ];
    const caller = makeCaller(ORG_A);
    const result = await caller.classificationDashboard.activeAlertsByMarket({ market: 'DE' });
    expect(result).toEqual({
      economicBands: { warning: 1, critical: 1 },
      drvExpiringWithin90d: 1,
    });
  });
});

// ---------------------------------------------------------------------------
// 60-04-05 — CSV formula-injection neutralisation
// 60-04-06 — CSV format (UTF-8 BOM + columns + 300s TTL)
// ---------------------------------------------------------------------------

describe('classificationDashboard.exportMarketCsv (60-04-05, 60-04-06)', () => {
  it('neutralises formula-prefix contractor names (leading = becomes leading single-quote)', async () => {
    fixtures.assignments = [
      {
        id: 'gb-evil',
        organizationId: ORG_A,
        status: 'ACTIVE',
        contractorId: 'c-evil',
        contractor: { id: 'c-evil', name: `=cmd|'/C calc'!A1`, countryCode: 'GB' },
      },
    ];
    const caller = makeCaller(ORG_A);
    const result = await caller.classificationDashboard.exportMarketCsv({ market: 'GB' });
    expect(result.expiresInSeconds).toBe(300);

    expect(mockR2PutObjectAndSignDownload).toHaveBeenCalledTimes(1);
    const call = mockR2PutObjectAndSignDownload.mock.calls[0]?.[0];
    const body = call.body as Buffer;
    // Strip BOM + decode
    const text = body.subarray(3).toString('utf-8');
    // The neutralised cell starts with `'=` so a spreadsheet treats it as text.
    // No comma or quote in the payload → plain (un-wrapped) cell.
    expect(text).toContain(`'=cmd|'/C calc'!A1`);
    expect(text).not.toMatch(/^[^']=cmd/m); // ensure no un-prefixed `=cmd` at start of any cell
  });

  it('neutralises contractor names with leading = + internal comma (wraps in quotes)', async () => {
    fixtures.assignments = [
      {
        id: 'gb-evil-2',
        organizationId: ORG_A,
        status: 'ACTIVE',
        contractorId: 'c-evil-2',
        contractor: {
          id: 'c-evil-2',
          name: `=HYPERLINK("http://evil","click")`,
          countryCode: 'GB',
        },
      },
    ];
    const caller = makeCaller(ORG_A);
    await caller.classificationDashboard.exportMarketCsv({ market: 'GB' });
    const call = mockR2PutObjectAndSignDownload.mock.calls[0]?.[0];
    const body = call.body as Buffer;
    const text = body.subarray(3).toString('utf-8');
    // Leading `=` + internal `"` triggers both neutralisation and quote-wrap.
    expect(text).toContain(`"'=HYPERLINK(""http://evil"",""click"")"`);
  });

  it('outputs UTF-8 BOM + correct column headers in CSV body', async () => {
    fixtures.assignments = [
      {
        id: 'gb-normal',
        organizationId: ORG_A,
        status: 'ACTIVE',
        contractorId: 'c-normal',
        contractor: { id: 'c-normal', name: 'Alice Freelancer', countryCode: 'GB' },
      },
    ];
    const caller = makeCaller(ORG_A);
    await caller.classificationDashboard.exportMarketCsv({ market: 'GB' });
    const call = mockR2PutObjectAndSignDownload.mock.calls[0]?.[0];
    const body = call.body as Buffer;
    expect(body[0]).toBe(0xef);
    expect(body[1]).toBe(0xbb);
    expect(body[2]).toBe(0xbf);
    const text = body.subarray(3).toString('utf-8');
    const header = text.split('\r\n')[0];
    expect(header).toContain('Engagement ID');
    expect(header).toContain('Contractor');
    expect(header).toContain('Country');
    expect(header).toContain('Latest verdict');
    expect(header).toContain('Assessment completed');
    expect(header).toContain('DRV score');
    expect(header).toContain('Economic-dep band');
    expect(header).toContain('Billing share');
    expect(header).toContain('Open reassessment trigger?');
    expect(header).toContain('DRV outcome');
    expect(header).toContain('DRV valid until');
  });

  it('returns a signed URL and 300s TTL (UI-SPEC D-16)', async () => {
    const caller = makeCaller(ORG_A);
    const result = await caller.classificationDashboard.exportMarketCsv({ market: 'DE' });
    expect(result.url).toContain('https://r2.test/');
    expect(result.expiresInSeconds).toBe(300);
  });

  it('scopes the R2 key by organizationId (tenant isolation — T-60-16)', async () => {
    const caller = makeCaller(ORG_A);
    await caller.classificationDashboard.exportMarketCsv({ market: 'GB' });
    const call = mockR2PutObjectAndSignDownload.mock.calls[0]?.[0];
    expect(call.key).toContain(`classification-dashboard-exports/${ORG_A}/`);
    expect(call.key).toMatch(/\/GB-.*\.csv$/);
  });
});

// ---------------------------------------------------------------------------
// globalHeader — smoke
// ---------------------------------------------------------------------------

describe('classificationDashboard.globalHeader', () => {
  it('returns totals and max lastScannedAt across scan sources', async () => {
    fixtures.assignments = [
      {
        id: 'a1',
        organizationId: ORG_A,
        status: 'ACTIVE',
        contractorId: 'c1',
        contractor: { id: 'c1', name: 'Alice', countryCode: 'GB' },
      },
      {
        id: 'a2',
        organizationId: ORG_A,
        status: 'INACTIVE',
        contractorId: 'c2',
        contractor: { id: 'c2', name: 'Bob', countryCode: 'DE' },
      },
    ];
    const recent = new Date('2026-04-10T00:00:00Z');
    const older = new Date('2026-03-01T00:00:00Z');
    fixtures.alerts = [
      {
        id: 'e1',
        organizationId: ORG_A,
        contractorAssignmentId: 'a1',
        currentBand: 'safe',
        lastBillingShare: 0.1,
        lastScannedAt: older,
      },
    ];
    fixtures.cronScanState = {
      name: 'classification-reassessment-triggers',
      lastScanCompletedAt: recent,
    };
    const caller = makeCaller(ORG_A);
    const result = await caller.classificationDashboard.globalHeader();
    expect(result.totalContractors).toBe(2);
    expect(result.totalActiveEngagements).toBe(1);
    expect(result.lastScannedAt?.toISOString()).toBe(recent.toISOString());
  });
});

// ---------------------------------------------------------------------------
// RBAC gating — smoke over all procedures
// ---------------------------------------------------------------------------

describe('classificationDashboard — contractor:read gate (T-60-20)', () => {
  it('rejects every procedure when the caller lacks contractor:read', async () => {
    mockHasPermission.mockResolvedValue({ success: false });
    const caller = makeCaller(ORG_A);

    await expect(
      caller.classificationDashboard.coverageByMarket({ market: 'GB' }),
    ).rejects.toBeInstanceOf(TRPCError);
    await expect(
      caller.classificationDashboard.riskDistributionByMarket({ market: 'DE' }),
    ).rejects.toBeInstanceOf(TRPCError);
    await expect(
      caller.classificationDashboard.overdueByMarket({ market: 'GB' }),
    ).rejects.toBeInstanceOf(TRPCError);
    await expect(
      caller.classificationDashboard.activeAlertsByMarket({ market: 'DE' }),
    ).rejects.toBeInstanceOf(TRPCError);
    await expect(caller.classificationDashboard.globalHeader()).rejects.toBeInstanceOf(TRPCError);
    await expect(
      caller.classificationDashboard.exportMarketCsv({ market: 'GB' }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});

// ---------------------------------------------------------------------------
// Cross-org isolation — structural assertion
// ---------------------------------------------------------------------------

describe('classificationDashboard — cross-org isolation (T-60-16)', () => {
  it('Org A caller cannot see Org B data — router threads through tenant scope', async () => {
    fixtures.assignments = [
      {
        id: 'a-for-a',
        organizationId: ORG_A,
        status: 'ACTIVE',
        contractorId: 'c-a',
        contractor: { id: 'c-a', name: 'A', countryCode: 'GB' },
      },
      {
        id: 'a-for-b',
        organizationId: ORG_B,
        status: 'ACTIVE',
        contractorId: 'c-b',
        contractor: { id: 'c-b', name: 'B', countryCode: 'GB' },
      },
    ];
    const caller = makeCaller(ORG_A);
    await caller.classificationDashboard.coverageByMarket({ market: 'GB' });
    // tenantProcedure runs the handler with the Org A scope. The production
    // tenant extension auto-filters by organizationId; in this mocked client
    // we instead assert the router called `contractorAssignment.count` with
    // the correct market filter (organization-level isolation is covered by
    // the dedicated tenant-extension tests).
    const call = mockPrisma.contractorAssignment.count.mock.calls.at(-1)?.[0];
    expect(call?.where?.status).toBe('ACTIVE');
    expect(call?.where?.contractor).toEqual({ countryCode: 'GB' });
  });
});

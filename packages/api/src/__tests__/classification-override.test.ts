// US classification override — reason-required + audit-logged + AB5 work-state trigger.
//
// The override records a human decision plus its reason into the append-only
// AuditLog (action `classification.override`); the scored outcome stays
// server-derived. The advisory outcome is recomputed with the resolved AB5
// work state (engagement work-state first, contractor US state as fallback) so
// the audit trail captures exactly what was overridden.
//
// Harness mirrors gulf-override-audit.test.ts: a hoisted mockPrisma, full
// @contractor-ops/db + auth + logger + feature-flags mocks (both
// module.classification-engine and module.us-expansion enabled),
// createCallerFactory(appRouter), and a spied writeAuditLog.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const ASSIGNMENT_ID = 'clasgnaaaaaaaaaaaaaaaaaaaaa';
const CONTRACTOR_ID = 'clcontaaaaaaaaaaaaaaaaaaaaa';

const { mockPrisma, auditWriteSpy } = vi.hoisted(() => {
  const contractorAssignment = { findFirst: vi.fn() };
  const classificationAssessment = { findFirst: vi.fn(async () => ({ answers: {} })) };
  const auditLog = {
    create: vi.fn(async () => ({ id: 'audit_1' })),
    createMany: vi.fn(async () => ({ count: 0 })),
    findMany: vi.fn(async () => []),
  };
  const organization = {
    findUnique: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })),
    findUniqueOrThrow: vi.fn(async () => ({ countryCode: 'US' })),
  };
  const base = { contractorAssignment, classificationAssessment, auditLog, organization };
  const mockPrisma = {
    ...base,
    $transaction: vi.fn(async (fn: (tx: typeof base) => unknown) => fn(base)),
  };
  return { mockPrisma, auditWriteSpy: vi.fn(async () => undefined) };
});

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
  tenantStore: {
    run: (_c: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

vi.mock('@contractor-ops/feature-flags', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const enabledBag = {
    values: { 'module.classification-engine': true, 'module.us-expansion': true },
    isEnabled: (key: string) =>
      key === 'module.classification-engine' || key === 'module.us-expansion',
  };
  return {
    ...actual,
    buildFlagBag: vi.fn(() => enabledBag),
    lazyFlagBag: vi.fn(() => enabledBag),
    evaluate: vi.fn((key: string) =>
      key === 'module.classification-engine' || key === 'module.us-expansion'
        ? { enabled: true, reason: 'mocked' }
        : { enabled: false, reason: 'mocked' },
    ),
  };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: vi.fn().mockResolvedValue({ success: true }) },
  },
  authApi: { hasPermission: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock('../services/audit-writer', () => ({
  writeAuditLog: auditWriteSpy,
  writeAuditLogMany: vi.fn(async () => undefined),
}));

vi.mock('@sentry/node', () => {
  const span = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    getCurrentScope: vi.fn(() => ({
      setUser: vi.fn(),
      setTag: vi.fn(),
      setTags: vi.fn(),
      setContext: vi.fn(),
      setExtra: vi.fn(),
      clear: vi.fn(),
    })),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (s: typeof span) => unknown) => fn(span)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
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
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

import { authApi } from '@contractor-ops/auth';
import { createCallerFactory } from '../init';
import { appRouter } from '../root';

const createCaller = createCallerFactory(appRouter);

function makeCaller(role = 'admin') {
  const session = {
    session: {
      id: `session-${USER_ID}`,
      userId: USER_ID,
      activeOrganizationId: ORG_ID,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: USER_ID,
      name: 'Admin Jane',
      email: `${USER_ID}@example.com`,
      emailVerified: true,
      image: null,
      role,
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

function setAssignment(overrides: {
  workState?: string | null;
  countryCode?: string;
  countryFields?: Record<string, unknown> | null;
}) {
  mockPrisma.contractorAssignment.findFirst.mockResolvedValue({
    id: ASSIGNMENT_ID,
    contractorId: CONTRACTOR_ID,
    workState: overrides.workState ?? null,
    contractor: {
      countryCode: overrides.countryCode ?? 'US',
      countryFields: overrides.countryFields ?? null,
    },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authApi.hasPermission).mockResolvedValue({ success: true } as never);
  mockPrisma.classificationAssessment.findFirst.mockResolvedValue({ answers: {} } as never);
  mockPrisma.organization.findUnique.mockResolvedValue({
    dataRegion: 'EU',
    status: 'ACTIVE',
  } as never);
});

describe('classification.override — US worker-classification override (US-CLASS-02)', () => {
  it('writes an audit log with action classification.override and the reason', async () => {
    setAssignment({ workState: 'TX', countryCode: 'US' });
    const caller = makeCaller();

    const out = (await caller.classification.override({
      contractorAssignmentId: ASSIGNMENT_ID,
      overrideVerdict: 'independent-contractor',
      reason: 'Engagement reviewed by outside counsel; ABC prong B satisfied.',
    })) as { overrideVerdict: string; ab5Flag: boolean };

    expect(out.overrideVerdict).toBe('independent-contractor');
    expect(auditWriteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'classification.override',
        organizationId: ORG_ID,
        resourceType: 'CONTRACTOR',
        resourceId: CONTRACTOR_ID,
        newValues: expect.objectContaining({ verdict: 'independent-contractor' }),
        metadata: expect.objectContaining({
          reason: 'Engagement reviewed by outside counsel; ABC prong B satisfied.',
        }),
      }),
    );
  });

  it('rejects an empty (whitespace-only) reason and writes no audit log', async () => {
    setAssignment({ workState: 'TX', countryCode: 'US' });
    const caller = makeCaller();

    await expect(
      caller.classification.override({
        contractorAssignmentId: ASSIGNMENT_ID,
        overrideVerdict: 'employee',
        reason: '   ',
      }),
    ).rejects.toThrow(/classificationOverrideReasonRequired/);
    expect(auditWriteSpy).not.toHaveBeenCalled();
  });

  it('auto-flags AB5 when the engagement work state is California', async () => {
    setAssignment({ workState: 'CA', countryCode: 'US' });
    const caller = makeCaller();

    const out = (await caller.classification.override({
      contractorAssignmentId: ASSIGNMENT_ID,
      overrideVerdict: 'independent-contractor',
      reason: 'Reviewed AB5 exemption eligibility with adviser.',
    })) as { ab5Flag: boolean; workState: string | null };

    expect(out.ab5Flag).toBe(true);
    expect(out.workState).toBe('CA');
    expect(auditWriteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        oldValues: expect.objectContaining({ ab5Flag: true }),
      }),
    );
  });

  it('falls back to the contractor US state for the AB5 trigger when work-state is unset', async () => {
    setAssignment({ workState: null, countryCode: 'US', countryFields: { state: 'CA' } });
    const caller = makeCaller();

    const out = (await caller.classification.override({
      contractorAssignmentId: ASSIGNMENT_ID,
      overrideVerdict: 'employee',
      reason: 'Contractor state on file is California; AB5 applies.',
    })) as { ab5Flag: boolean; workState: string | null };

    expect(out.ab5Flag).toBe(true);
    expect(out.workState).toBe('CA');
  });

  it('rejects a non-US engagement', async () => {
    setAssignment({ workState: null, countryCode: 'GB' });
    const caller = makeCaller();

    await expect(
      caller.classification.override({
        contractorAssignmentId: ASSIGNMENT_ID,
        overrideVerdict: 'employee',
        reason: 'Attempted override on a UK engagement.',
      }),
    ).rejects.toThrow(/classificationOverrideUsOnly/);
    expect(auditWriteSpy).not.toHaveBeenCalled();
  });
});

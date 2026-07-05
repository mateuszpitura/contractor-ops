// employeeTime + ewidencja router contracts (Plan 11):
//   - upsertRecord saves a day-grain record and returns the synchronous WT-check
//     findings as a NON-BLOCKING warning payload (a breach never throws).
//   - ewidencja.generate freezes a snapshot via the INSERT-only builder (create,
//     never update) and writes the ewidencja.generated audit row.
//
// Exercised through createCaller over a mocked ctx that runs the real flag +
// RBAC + transaction flow with REAL compliance-policy + wt-limit-check +
// ewidencja-builder; only the I/O boundaries are mocked. No live DB.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clorg0000000000000000000001';
const USER_ID = 'cluser000000000000000000001';
const WORKER_ID = 'clwork000000000000000000001';

const { mockPrisma } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;
  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(async () => ({ id: ORG_ID, dataRegion: 'EU', status: 'ACTIVE' })),
    },
    employeeProfile: { findFirst: vi.fn(async () => ({ id: 'profile-1', countryCode: 'DE' })) },
    employeeTimeRecord: {
      upsert: vi.fn(async () => ({ id: 'etr-1', workedMinutes: 660 })),
      findMany: vi.fn(async () => [{ workedMinutes: 660 }]),
    },
    leaveLedgerEntry: { findMany: vi.fn(async () => []) },
    ewidencjaSnapshot: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: 'ewi-1',
        version: args.data.version,
      })),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: { create: vi.fn(async () => ({ id: 'audit-1' })) },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };
  return { mockPrisma };
});

vi.mock('@contractor-ops/auth', () => ({
  authApi: { hasPermission: vi.fn().mockResolvedValue({ success: true }) },
  auth: {
    api: { getSession: vi.fn(), hasPermission: vi.fn().mockResolvedValue({ success: true }) },
  },
}));

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

vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: vi.fn(() => ({ enabled: true, reason: 'test' })),
}));

vi.mock('../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {
    orgMeta: (o: string) => `org:${o}:meta`,
    dashboardPrefix: (o: string) => `dash:${o}`,
  },
  CacheTTL: { ORG_META: 300, ORG_SETTINGS: 300 },
}));

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  withBodyLogging: vi.fn((_o: unknown, fn: unknown) => fn),
  logIntegrationCall: vi.fn(),
  subscribeOpossumEvents: vi.fn(),
  runWithRequestContext: vi.fn((_c: unknown, fn: () => unknown) => fn()),
  getRequestId: vi.fn(() => undefined),
  getTraceparent: vi.fn(() => undefined),
  buildContextFromHeaders: vi.fn(() => ({})),
  getOutboundHeaders: vi.fn(() => ({})),
  generateRequestId: vi.fn(() => 'test-request-id'),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  LOG_BODY_INCLUDE_PREFIXES: [],
  PII_MASK_KEYWORDS: [],
  PII_MASK_PATHS: [],
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn(), gauge: vi.fn() },
}));

vi.mock('@sentry/node', () => ({
  getCurrentScope: vi.fn(() => ({ setUser: vi.fn(), setTag: vi.fn(), setContext: vi.fn() })),
  startSpan: vi.fn((_o: unknown, fn: (s: unknown) => unknown) =>
    fn({ setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() }),
  ),
  captureException: vi.fn(),
}));

import { createCallerFactory } from '../init';
import { employeeTimeRouter } from '../routers/workforce/employee-time';
import { ewidencjaRouter } from '../routers/workforce/ewidencja';

function makeCaller<T extends Parameters<typeof createCallerFactory>[0]>(r: T) {
  const session = {
    session: {
      id: 's1',
      userId: USER_ID,
      activeOrganizationId: ORG_ID,
      expiresAt: new Date('2099-01-01'),
      token: 't',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: USER_ID,
      name: 'HR',
      email: 'hr@example.com',
      emailVerified: true,
      image: null,
      banned: false,
      banReason: null,
      banExpires: null,
      role: 'hr_admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  return createCallerFactory(r)({
    headers: new Headers(),
    session: session as never,
    user: session.user as never,
  });
}

const timeCaller = makeCaller(employeeTimeRouter);
const ewidencjaCaller = makeCaller(ewidencjaRouter);

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.organization.findUnique.mockResolvedValue({
    id: ORG_ID,
    dataRegion: 'EU',
    status: 'ACTIVE',
  });
  mockPrisma.employeeProfile.findFirst.mockResolvedValue({ id: 'profile-1', countryCode: 'DE' });
  mockPrisma.employeeTimeRecord.upsert.mockResolvedValue({ id: 'etr-1', workedMinutes: 660 });
  mockPrisma.employeeTimeRecord.findMany.mockResolvedValue([{ workedMinutes: 660 }]);
  mockPrisma.ewidencjaSnapshot.findFirst.mockResolvedValue(null);
});

describe('employeeTime.upsertRecord — non-blocking WT findings', () => {
  it('saves the record and returns a DE daily-ceiling breach finding without throwing', async () => {
    const out = await timeCaller.upsertRecord({
      workerId: WORKER_ID,
      workDate: '2026-03-02',
      workedMinutes: 660, // > DE 600-minute (10h) hard ceiling
      nightMinutes: 0,
      overtimeMinutes50: 0,
      overtimeMinutes100: 0,
      weekendHolidayMinutes: 0,
      onCallMinutes: 0,
      wtOptOut: false,
      source: 'MANUAL',
    });

    expect(mockPrisma.employeeTimeRecord.upsert).toHaveBeenCalled();
    expect(out.record).toMatchObject({ id: 'etr-1' });
    expect(out.findings.some(f => f.dimension === 'daily' && f.level === 'breach')).toBe(true);
  });
});

describe('ewidencja.generate — INSERT-only + audit', () => {
  it('inserts a version-1 snapshot (never updates a prior row) and writes the audit', async () => {
    // The builder reads full time-record rows; an empty period keeps the
    // snapshot deterministic and focuses the test on the INSERT-only supersede.
    mockPrisma.employeeTimeRecord.findMany.mockResolvedValue([]);

    const out = await ewidencjaCaller.generate({
      workerId: WORKER_ID,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
    });

    expect(mockPrisma.ewidencjaSnapshot.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.ewidencjaSnapshot.update).not.toHaveBeenCalled();
    expect(mockPrisma.ewidencjaSnapshot.updateMany).not.toHaveBeenCalled();
    expect(out).toMatchObject({ id: 'ewi-1', version: 1, periodKey: '2026-01' });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'ewidencja.generated' }) }),
    );
  });
});

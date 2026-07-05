// Sick-leave contract: manual sick entry is a DIRECT absence record —
// a notification, NOT an approval request. recordSickAbsence writes a direct
// LeaveLedgerEntry + a plain notification (never APPROVAL_REQUEST) and creates
// ZERO ApprovalFlow rows (e-ZLA/eAU auto-pull is deferred to a later milestone).
//
// Exercised through the leave router (createCaller over a mocked ctx that runs
// the real flag + RBAC + transaction control flow, mocking only I/O). No live DB.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clorg0000000000000000000001';
const USER_ID = 'cluser000000000000000000001';
const WORKER_ID = 'clwork000000000000000000001';
const SICK_TYPE_ID = 'clsick000000000000000000001';
const APPROVER_ID = 'clappr000000000000000000001';

const { mockPrisma } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;
  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(async () => ({ id: ORG_ID, dataRegion: 'EU', status: 'ACTIVE' })),
    },
    worker: { findFirst: vi.fn(async () => ({ id: WORKER_ID })) },
    leaveType: { findFirst: vi.fn(async () => ({ id: SICK_TYPE_ID })) },
    leaveLedgerEntry: {
      create: vi.fn(async () => ({ id: 'ledger-sick-1', leaveTypeId: SICK_TYPE_ID })),
      findMany: vi.fn(async () => []),
    },
    leaveBalance: { upsert: vi.fn(async () => ({})) },
    auditLog: { create: vi.fn(async () => ({ id: 'audit-1' })) },
    member: { findMany: vi.fn(async () => [{ userId: APPROVER_ID }]) },
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

vi.mock('../services/approval-engine', () => ({
  routeToLeaveChain: vi.fn(async () => ({ id: 'chain', stepsJson: [] })),
  createApprovalFlow: vi.fn(async () => ({ id: 'flow', steps: [] })),
}));

vi.mock('../services/notification-service', () => ({ dispatch: vi.fn(async () => undefined) }));

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

vi.mock('../services/calendar-deadline-sync', () => ({
  syncPaymentDueDeadline: vi.fn(async () => undefined),
  syncApprovalSlaDeadline: vi.fn(async () => undefined),
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
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@sentry/node', () => ({
  getCurrentScope: vi.fn(() => ({ setUser: vi.fn(), setTag: vi.fn(), setContext: vi.fn() })),
  startSpan: vi.fn((_o: unknown, fn: (s: unknown) => unknown) =>
    fn({ setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() }),
  ),
  captureException: vi.fn(),
}));

import { createCallerFactory } from '../init';
import { leaveRouter } from '../routers/workforce/leave';
import { createApprovalFlow } from '../services/approval-engine';
import { dispatch } from '../services/notification-service';

const createCaller = createCallerFactory(leaveRouter);

function makeCaller() {
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
  return createCaller({
    headers: new Headers(),
    session: session as never,
    user: session.user as never,
  });
}

const caller = makeCaller();

const SICK_INPUT = {
  workerId: WORKER_ID,
  startDate: '2026-04-01',
  endDate: '2026-04-03',
  minutes: 1440,
  note: 'flu',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.organization.findUnique.mockResolvedValue({
    id: ORG_ID,
    dataRegion: 'EU',
    status: 'ACTIVE',
  });
  mockPrisma.worker.findFirst.mockResolvedValue({ id: WORKER_ID });
  mockPrisma.leaveType.findFirst.mockResolvedValue({ id: SICK_TYPE_ID });
  mockPrisma.leaveLedgerEntry.create.mockResolvedValue({
    id: 'ledger-sick-1',
    leaveTypeId: SICK_TYPE_ID,
  });
  mockPrisma.leaveLedgerEntry.findMany.mockResolvedValue([]);
  mockPrisma.member.findMany.mockResolvedValue([{ userId: APPROVER_ID }]);
});

describe('recordSickAbsence is a direct absence, not an approval request', () => {
  it('writes a direct LeaveLedgerEntry for the sick period', async () => {
    await caller.recordSickAbsence(SICK_INPUT);

    expect(mockPrisma.leaveLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entryType: 'DEDUCTION',
          minutes: -1440,
          leaveTypeId: SICK_TYPE_ID,
        }),
      }),
    );
  });

  it('dispatches a plain notification (never type APPROVAL_REQUEST)', async () => {
    await caller.recordSickAbsence(SICK_INPUT);

    expect(vi.mocked(dispatch)).toHaveBeenCalledTimes(1);
    const event = vi.mocked(dispatch).mock.calls[0][0];
    expect(event.type).toBe('LEAVE_SICK_RECORDED');
    expect(event.type).not.toBe('APPROVAL_REQUEST');
    expect(event.recipientUserIds).toEqual([APPROVER_ID]);
  });

  it('creates NO ApprovalFlow rows', async () => {
    await caller.recordSickAbsence(SICK_INPUT);

    expect(vi.mocked(createApprovalFlow)).not.toHaveBeenCalled();
  });

  it('writes an audit log (leave.sick.recorded)', async () => {
    await caller.recordSickAbsence(SICK_INPUT);

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'leave.sick.recorded' }) }),
    );
  });
});

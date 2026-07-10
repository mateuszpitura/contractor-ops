// Leave approval integration contract: a leave request routes through the
// generic approval-chain (ApprovalFlow with resourceType='LEAVE_REQUEST'), and
// approving it inserts a DEDUCTION LeaveLedgerEntry + decrements the balance
// cache in the same transaction (finalizeApprovedLeave).
//
// Submit is exercised through the leave router (createCaller over a mocked ctx
// that runs the real flag + RBAC + transaction control flow, mocking only the
// I/O boundaries). Approve is exercised directly against finalizeApprovedLeave
// with a mock tx. No live DB.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clorg0000000000000000000001';
const USER_ID = 'cluser000000000000000000001';
const WORKER_ID = 'clwork000000000000000000001';
const LEAVE_TYPE_ID = 'clltype00000000000000000001';
const CHAIN_ID = 'clchain00000000000000000001';
const FLOW_ID = 'clflow000000000000000000001';
const REQUEST_ID = 'clreq0000000000000000000001';
const APPROVER_ID = 'clappr000000000000000000001';

const { mockPrisma } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;
  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(async () => ({ id: ORG_ID, dataRegion: 'EU', status: 'ACTIVE' })),
    },
    subscription: {
      findUnique: vi.fn(async () => ({
        status: 'ACTIVE',
        tier: 'ENTERPRISE',
        addOns: ['workforce'],
      })),
    },
    worker: { findFirst: vi.fn(async () => ({ id: WORKER_ID })) },
    leaveType: { findFirst: vi.fn(async () => ({ id: LEAVE_TYPE_ID })) },
    blackoutPeriod: { findFirst: vi.fn(async () => null) },
    leaveLedgerEntry: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => [{ minutes: 100000 }]),
      create: vi.fn(async () => ({ id: 'ledger-1' })),
    },
    leaveBalance: { upsert: vi.fn(async () => ({})) },
    leaveRequest: {
      create: vi.fn(async () => ({ id: REQUEST_ID, teamId: null })),
      update: vi.fn(async () => ({ id: REQUEST_ID, status: 'PENDING', approvalFlowId: FLOW_ID })),
    },
    approvalChainConfig: {
      findMany: vi.fn(async () => [
        {
          id: 'chain-1',
          isDefault: true,
          conditionsJson: null,
          stepsJson: [{ name: 'Mgr', approverUserId: APPROVER_ID, slaHours: 24, required: true }],
        },
      ]),
    },
    approvalFlow: {
      create: vi.fn(async () => ({
        id: FLOW_ID,
        steps: [{ id: 'step-1', stepOrder: 1, status: 'PENDING' }],
      })),
    },
    approvalStep: {
      findFirst: vi.fn(async () => ({ approverUserId: APPROVER_ID, slaDeadline: null })),
    },
    auditLog: { create: vi.fn(async () => ({ id: 'audit-1' })) },
    member: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => ({ userId: APPROVER_ID })),
    },
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
  routeToLeaveChain: vi.fn(async () => ({ id: CHAIN_ID, stepsJson: [] })),
  createApprovalFlow: vi.fn(async () => ({ id: FLOW_ID, steps: [] })),
}));

vi.mock('../services/notification-service', () => ({ dispatch: vi.fn(async () => undefined) }));

vi.mock('../services/cache', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/cache')>();
  const { createPassthroughCacheMock } = await import('../__tests__/__mocks__/cache-service');
  return createPassthroughCacheMock(actual);
});

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
import { finalizeApprovedLeave } from '../routers/core/approval-shared';
import { leaveRouter } from '../routers/workforce/leave';
import { createApprovalFlow } from '../services/approval-engine';

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

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.organization.findUnique.mockResolvedValue({
    id: ORG_ID,
    dataRegion: 'EU',
    status: 'ACTIVE',
  });
  mockPrisma.worker.findFirst.mockResolvedValue({ id: WORKER_ID });
  mockPrisma.leaveType.findFirst.mockResolvedValue({ id: LEAVE_TYPE_ID });
  mockPrisma.blackoutPeriod.findFirst.mockResolvedValue(null);
  mockPrisma.leaveLedgerEntry.findMany.mockResolvedValue([{ minutes: 100000 }]);
  mockPrisma.leaveRequest.create.mockResolvedValue({ id: REQUEST_ID, teamId: null });
  mockPrisma.leaveRequest.update.mockResolvedValue({
    id: REQUEST_ID,
    status: 'PENDING',
    approvalFlowId: FLOW_ID,
  });
  mockPrisma.approvalStep.findFirst.mockResolvedValue({
    approverUserId: APPROVER_ID,
    slaDeadline: null,
  });
});

describe('leave request → approval-chain (submit)', () => {
  it('creates an ApprovalFlow with resourceType=LEAVE_REQUEST and status PENDING', async () => {
    const out = await caller.submitLeaveRequest({
      workerId: WORKER_ID,
      leaveTypeId: LEAVE_TYPE_ID,
      startDate: '2026-03-02',
      endDate: '2026-03-06',
      requestedMinutes: 2400,
    });

    expect(vi.mocked(createApprovalFlow)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ resourceType: 'LEAVE_REQUEST', resourceId: REQUEST_ID }),
    );
    expect(mockPrisma.leaveRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }),
    );
    expect(out).toMatchObject({ id: REQUEST_ID, approvalFlowId: FLOW_ID });
  });
});

describe('leave approval → ledger deduction (finalizeApprovedLeave)', () => {
  function makeTx() {
    return {
      leaveRequest: {
        findFirst: vi.fn(async () => ({
          id: REQUEST_ID,
          workerId: WORKER_ID,
          leaveTypeId: LEAVE_TYPE_ID,
          requestedMinutes: 480,
          startDate: new Date('2026-02-02'),
          endDate: new Date('2026-02-06'),
          status: 'PENDING',
          leaveType: { kind: 'ANNUAL' },
        })),
        update: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      leaveLedgerEntry: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: 'ledger-1' })),
        findMany: vi.fn(async () => [{ minutes: 100000 }]),
      },
      leaveBalance: { upsert: vi.fn(async () => ({})) },
      employeeTimeRecord: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => ({ id: 'time-1' })),
      },
      organization: {
        findUnique: vi.fn(async () => ({ countryCode: 'PL' })),
      },
      publicHoliday: {
        findMany: vi.fn(async () => []),
      },
      auditLog: { create: vi.fn(async () => ({ id: 'audit-1' })) },
    };
  }

  it('inserts a DEDUCTION ledger row + recomputes the balance cache on approve', async () => {
    const tx = makeTx();
    // biome-ignore lint/suspicious/noExplicitAny: mock tx delegate subset
    await finalizeApprovedLeave(tx as any, {
      resourceId: REQUEST_ID,
      organizationId: ORG_ID,
      userId: USER_ID,
    });

    expect(tx.leaveLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entryType: 'DEDUCTION', minutes: -480 }),
      }),
    );
    expect(tx.leaveBalance.upsert).toHaveBeenCalledTimes(1);
  });

  it('writes an audit log (leave.approved) inside the finalize transaction', async () => {
    const tx = makeTx();
    // biome-ignore lint/suspicious/noExplicitAny: mock tx delegate subset
    await finalizeApprovedLeave(tx as any, {
      resourceId: REQUEST_ID,
      organizationId: ORG_ID,
      userId: USER_ID,
    });

    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'leave.approved' }) }),
    );
  });
});

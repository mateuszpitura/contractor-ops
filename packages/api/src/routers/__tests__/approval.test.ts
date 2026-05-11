/**
 * Approval router — chain config list/get/delete (tenant + settings permission).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';
const CHAIN_ID = 'clchain00000000000000001';
const STEP_ID = 'clstep000000000000000001';
const FLOW_ID = 'clflow000000000000000001';
const INV_ID = 'clinv000000000000000001';
const STEP_ID_2 = 'clstep000000000000000002';
const DELEGATE_USER_ID = 'cluserrrrrrrrrrrrrrrrrrrrr';

const { mockPrisma } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    approvalChainConfig: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      updateMany: vi.fn(async () => ({ count: 0 })),
      delete: vi.fn(async () => ({})),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
    approvalFlow: {
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    },
    approvalStep: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      findUniqueOrThrow: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    $queryRaw: vi.fn(async () => []),
    approvalDecision: {
      create: vi.fn(async () => ({})),
    },
    invoice: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    },
    contractor: {
      findUnique: vi.fn(async () => null),
    },
    member: {
      findFirst: vi.fn(async () => null),
    },
    user: {
      findUnique: vi.fn(async () => null),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue({ success: true }),
    },
  },
  authApi: {
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
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

vi.mock('../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {
    approvalChains: (orgId: string) => `approval-chains:${orgId}`,
    orgSettings: (orgId: string) => `org-settings:${orgId}`,
    orgSettingsJson: (orgId: string, key: string) => `org-settings-json:${orgId}:${key}`,
    orgBranding: (orgId: string) => `org-branding:${orgId}`,
    settingsPrefix: (orgId: string) => `org-settings:${orgId}`,
    dashboardPrefix: (orgId: string) => `dash:${orgId}`,
  },
  CacheTTL: {
    APPROVAL_CHAINS: 300,
    ORG_SETTINGS: 300,
    ORG_SETTINGS_JSON: 300,
    ORG_BRANDING: 300,
  },
}));

vi.mock('../../services/approval-engine', () => ({
  routeToChain: vi.fn(async () => null),
  createApprovalFlow: vi.fn(async () => ({})),
  advanceFlow: vi.fn(async () => ({ completed: false })),
  computeSlaStatus: vi.fn(() => 'ON_TIME'),
}));

vi.mock('../../services/notification-service', () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/calendar-deadline-sync', () => ({
  syncPaymentDueDeadline: vi.fn(async () => undefined),
  syncApprovalSlaDeadline: vi.fn(async () => undefined),
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
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
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
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

import { createCallerFactory } from '../../init';
import { advanceFlow, createApprovalFlow, routeToChain } from '../../services/approval-engine';
import { invalidateByPrefix } from '../../services/cache';
import { syncPaymentDueDeadline } from '../../services/calendar-deadline-sync';
import { dispatch } from '../../services/notification-service';
import { approvalRouter } from '../core/approval';

const createCaller = createCallerFactory(approvalRouter);

function makeCaller() {
  const session = {
    session: {
      id: 'sess-approval',
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
      name: 'Admin',
      email: 'admin@example.com',
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

const caller = makeCaller();

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.organization.findUnique.mockResolvedValue({
    id: 'org-mock',
    dataRegion: 'EU',
    status: 'ACTIVE',
  });
  mockPrisma.approvalChainConfig.findMany.mockResolvedValue([]);
  mockPrisma.approvalChainConfig.findFirst.mockResolvedValue(null);
  mockPrisma.approvalFlow.findFirst.mockResolvedValue(null);
  mockPrisma.approvalFlow.findUnique.mockResolvedValue(null);
  mockPrisma.approvalStep.findMany.mockResolvedValue([]);
  mockPrisma.approvalStep.count.mockResolvedValue(0);
  mockPrisma.approvalStep.findFirst.mockResolvedValue(null);
  mockPrisma.invoice.findMany.mockResolvedValue([]);
  mockPrisma.invoice.findFirst.mockResolvedValue(null);
  mockPrisma.member.findFirst.mockResolvedValue(null);
  mockPrisma.approvalFlow.update.mockResolvedValue({});
  mockPrisma.user.findUnique.mockResolvedValue(null);
  mockPrisma.approvalChainConfig.findUnique.mockResolvedValue(null);
  mockPrisma.$queryRaw.mockResolvedValue([]);
  vi.mocked(routeToChain).mockResolvedValue(null);
  vi.mocked(createApprovalFlow).mockResolvedValue({ id: FLOW_ID, steps: [] });
  vi.mocked(advanceFlow).mockResolvedValue({
    completed: false,
    nextStepOrder: 2,
  });
});

describe('approval router — chains', () => {
  it('listChains returns invoice approval chains for org (cached)', async () => {
    mockPrisma.approvalChainConfig.findMany.mockResolvedValueOnce([
      { id: CHAIN_ID, name: 'Standard', resourceType: 'INVOICE' },
    ]);

    const rows = await caller.listChains();

    expect(mockPrisma.approvalChainConfig.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        resourceType: 'INVOICE',
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows).toEqual([{ id: CHAIN_ID, name: 'Standard', resourceType: 'INVOICE' }]);
  });

  it('getChain throws NOT_FOUND when chain is missing in org', async () => {
    await expect(caller.getChain({ id: CHAIN_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('getChain returns chain when found', async () => {
    mockPrisma.approvalChainConfig.findFirst.mockResolvedValueOnce({
      id: CHAIN_ID,
      name: 'Default',
      organizationId: ORG_ID,
    });

    const row = await caller.getChain({ id: CHAIN_ID });

    expect(mockPrisma.approvalChainConfig.findFirst).toHaveBeenCalledWith({
      where: { id: CHAIN_ID, organizationId: ORG_ID },
    });
    expect(row).toMatchObject({ id: CHAIN_ID, name: 'Default' });
  });

  it('deleteChain throws NOT_FOUND when chain does not exist', async () => {
    mockPrisma.approvalChainConfig.findFirst.mockResolvedValueOnce(null);

    await expect(caller.deleteChain({ id: CHAIN_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('deleteChain throws BAD_REQUEST when an active PENDING flow references the chain', async () => {
    mockPrisma.approvalChainConfig.findFirst.mockResolvedValueOnce({ id: CHAIN_ID });
    mockPrisma.approvalFlow.findFirst.mockResolvedValueOnce({
      id: 'flow-1',
      status: 'PENDING',
    });

    await expect(caller.deleteChain({ id: CHAIN_ID })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(mockPrisma.approvalChainConfig.delete).not.toHaveBeenCalled();
  });
});

describe('approval router — queue', () => {
  it('listPending returns empty page with my-tab org + approver filter', async () => {
    const res = await caller.listPending({});

    expect(mockPrisma.approvalStep.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_ID,
          approverUserId: USER_ID,
        }),
        orderBy: { slaDeadline: 'asc' },
        skip: 0,
        take: 10,
      }),
    );
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    expect(mockPrisma.approvalStep.count).toHaveBeenCalled();
    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [] } },
      }),
    );
    expect(res).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });
  });

  it('listPending all tab does not filter by approver', async () => {
    await caller.listPending({ tab: 'all' });

    const where = mockPrisma.approvalStep.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe(ORG_ID);
    expect(where.approverUserId).toBeUndefined();
  });

  it('listPending overdue sets PENDING and slaDeadline lt now', async () => {
    await caller.listPending({ status: 'overdue', tab: 'all' });

    expect(mockPrisma.approvalStep.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PENDING',
          slaDeadline: { lt: expect.any(Date) },
        }),
      }),
    );
  });

  it('listPending sortBy submitted orders by flow startedAt', async () => {
    await caller.listPending({ sortBy: 'submitted', tab: 'all' });

    expect(mockPrisma.approvalStep.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { approvalFlow: { startedAt: 'asc' } },
      }),
    );
  });

  it('listPending sortBy amount uses $queryRaw and skips findMany when no ids', async () => {
    await caller.listPending({ sortBy: 'amount', tab: 'all' });

    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    expect(mockPrisma.approvalStep.findMany).not.toHaveBeenCalled();
  });
});

describe('approval router — approve', () => {
  it('approve throws NOT_FOUND when step is missing', async () => {
    mockPrisma.approvalStep.findFirst.mockResolvedValueOnce(null);

    await expect(caller.approve({ stepId: STEP_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('approve throws BAD_REQUEST when step is not PENDING', async () => {
    mockPrisma.approvalStep.findFirst.mockResolvedValueOnce({
      id: STEP_ID,
      organizationId: ORG_ID,
      status: 'APPROVED',
      approverUserId: USER_ID,
      approvalFlowId: FLOW_ID,
      approvalFlow: { resourceId: INV_ID },
    });

    await expect(caller.approve({ stepId: STEP_ID })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('approve throws FORBIDDEN when step is assigned to another user', async () => {
    mockPrisma.approvalStep.findFirst.mockResolvedValueOnce({
      id: STEP_ID,
      organizationId: ORG_ID,
      status: 'PENDING',
      approverUserId: 'other-user',
      approvalFlowId: FLOW_ID,
      approvalFlow: { resourceId: INV_ID },
    });

    await expect(caller.approve({ stepId: STEP_ID })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('approve completes PENDING step for assignee and invalidates dashboard cache', async () => {
    mockPrisma.approvalStep.findFirst.mockResolvedValueOnce({
      id: STEP_ID,
      organizationId: ORG_ID,
      status: 'PENDING',
      approverUserId: USER_ID,
      approvalFlowId: FLOW_ID,
      approvalFlow: {
        id: FLOW_ID,
        resourceId: INV_ID,
        resourceType: 'INVOICE',
        status: 'PENDING',
      },
    });
    mockPrisma.approvalStep.findUniqueOrThrow.mockResolvedValueOnce({
      id: STEP_ID,
      status: 'APPROVED',
    });
    mockPrisma.invoice.findUnique.mockResolvedValue({
      id: INV_ID,
      invoiceNumber: 'INV-42',
      totalMinor: 10000,
      currency: 'PLN',
      contractorId: null,
      dueDate: null,
    });
    mockPrisma.approvalFlow.findUnique.mockResolvedValue({
      id: FLOW_ID,
      createdByUserId: null,
      steps: [],
    });
    mockPrisma.approvalStep.update.mockResolvedValueOnce({
      id: STEP_ID,
      status: 'APPROVED',
    });

    const out = await caller.approve({ stepId: STEP_ID, comment: 'ok' });

    expect(mockPrisma.approvalDecision.create).toHaveBeenCalled();
    expect(mockPrisma.approvalStep.update).toHaveBeenCalled();
    expect(out).toMatchObject({ id: STEP_ID, status: 'APPROVED' });
    expect(invalidateByPrefix).toHaveBeenCalledWith(`dash:${ORG_ID}`);
    expect(advanceFlow).toHaveBeenCalledWith(expect.anything(), FLOW_ID);
  });

  it('approve dispatches APPROVAL_DECISION to submitter after decision', async () => {
    const submitterId = 'user-submitter-001';
    mockPrisma.approvalStep.findFirst.mockResolvedValueOnce({
      id: STEP_ID,
      organizationId: ORG_ID,
      status: 'PENDING',
      approverUserId: USER_ID,
      approvalFlowId: FLOW_ID,
      approvalFlow: {
        id: FLOW_ID,
        resourceId: INV_ID,
        resourceType: 'INVOICE',
        status: 'PENDING',
      },
    });
    mockPrisma.approvalStep.findUniqueOrThrow.mockResolvedValueOnce({
      id: STEP_ID,
      status: 'APPROVED',
    });
    mockPrisma.invoice.findUnique.mockResolvedValue({
      id: INV_ID,
      invoiceNumber: 'INV-42',
      totalMinor: 10000,
      currency: 'PLN',
      contractorId: null,
      dueDate: null,
    });
    mockPrisma.approvalFlow.findUnique.mockResolvedValue({
      id: FLOW_ID,
      createdByUserId: submitterId,
      steps: [],
    });

    await caller.approve({ stepId: STEP_ID });

    expect(vi.mocked(dispatch)).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        type: 'APPROVAL_DECISION',
        recipientUserIds: [submitterId],
        entityType: 'INVOICE',
        entityId: INV_ID,
        metadata: expect.objectContaining({ decision: 'approved' }),
      }),
    );
  });

  it('approve syncs calendar payment deadline when flow completes and invoice has dueDate', async () => {
    vi.mocked(advanceFlow).mockResolvedValueOnce({
      completed: true,
      flowStatus: 'APPROVED',
    });
    mockPrisma.approvalStep.findFirst.mockResolvedValueOnce({
      id: STEP_ID,
      organizationId: ORG_ID,
      status: 'PENDING',
      approverUserId: USER_ID,
      approvalFlowId: FLOW_ID,
      approvalFlow: {
        id: FLOW_ID,
        resourceId: INV_ID,
        resourceType: 'INVOICE',
        status: 'PENDING',
      },
    });
    mockPrisma.approvalStep.findUniqueOrThrow.mockResolvedValueOnce({
      id: STEP_ID,
      status: 'APPROVED',
    });
    const due = new Date('2025-12-31T00:00:00.000Z');
    mockPrisma.invoice.findUnique.mockResolvedValue({
      id: INV_ID,
      invoiceNumber: 'INV-42',
      totalMinor: 10000,
      currency: 'PLN',
      contractorId: 'ctr-cal',
      dueDate: due,
    });
    mockPrisma.approvalFlow.findUnique.mockResolvedValue({
      id: FLOW_ID,
      createdByUserId: null,
      steps: [],
    });
    mockPrisma.contractor.findUnique.mockResolvedValue({
      displayName: 'Cal Contractor',
    });

    await caller.approve({ stepId: STEP_ID });

    expect(vi.mocked(syncPaymentDueDeadline)).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({
        organizationId: ORG_ID,
        invoiceId: INV_ID,
        invoiceNumber: 'INV-42',
        contractorName: 'Cal Contractor',
        dueDate: due,
        userId: USER_ID,
      }),
    );
  });
});

const REJECT_COMMENT = 'reject note must be at least ten chars';

describe('approval router — reject', () => {
  it('reject throws NOT_FOUND when step is missing', async () => {
    mockPrisma.approvalStep.findFirst.mockResolvedValueOnce(null);

    await expect(caller.reject({ stepId: STEP_ID, comment: REJECT_COMMENT })).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    );
  });

  it('reject throws BAD_REQUEST when step status is not PENDING', async () => {
    mockPrisma.approvalStep.findFirst.mockResolvedValueOnce({
      id: STEP_ID,
      organizationId: ORG_ID,
      status: 'APPROVED',
      approverUserId: USER_ID,
      approvalFlowId: FLOW_ID,
      approvalFlow: { resourceId: INV_ID },
    });

    await expect(caller.reject({ stepId: STEP_ID, comment: REJECT_COMMENT })).rejects.toMatchObject(
      { code: 'BAD_REQUEST' },
    );
  });

  it('reject throws FORBIDDEN when the calling user is not the assigned approver', async () => {
    mockPrisma.approvalStep.findFirst.mockResolvedValueOnce({
      id: STEP_ID,
      organizationId: ORG_ID,
      status: 'PENDING',
      approverUserId: 'other-user',
      approvalFlowId: FLOW_ID,
      approvalFlow: { resourceId: INV_ID },
    });

    await expect(caller.reject({ stepId: STEP_ID, comment: REJECT_COMMENT })).rejects.toMatchObject(
      { code: 'FORBIDDEN' },
    );
  });

  it('reject completes and updates flow + invoice', async () => {
    mockPrisma.approvalStep.findFirst.mockResolvedValueOnce({
      id: STEP_ID,
      organizationId: ORG_ID,
      status: 'PENDING',
      approverUserId: USER_ID,
      approvalFlowId: FLOW_ID,
      approvalFlow: { resourceId: INV_ID, createdByUserId: 'other-user' },
    });
    mockPrisma.approvalStep.findUniqueOrThrow.mockResolvedValueOnce({
      id: STEP_ID,
      status: 'REJECTED',
    });
    mockPrisma.invoice.findUnique.mockResolvedValue({
      id: INV_ID,
      invoiceNumber: 'INV-9',
    });
    mockPrisma.approvalFlow.findUnique.mockResolvedValue({ createdByUserId: null });
    mockPrisma.approvalStep.update.mockResolvedValueOnce({
      id: STEP_ID,
      status: 'REJECTED',
    });

    const out = await caller.reject({ stepId: STEP_ID, comment: REJECT_COMMENT });

    expect(mockPrisma.approvalFlow.update).toHaveBeenCalled();
    expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INV_ID },
        data: { status: 'REJECTED' },
      }),
    );
    expect(out).toMatchObject({ id: STEP_ID, status: 'REJECTED' });
  });

  it('reject dispatches APPROVAL_DECISION to submitter when present', async () => {
    const submitterId = 'user-submitter-002';
    mockPrisma.approvalStep.findFirst.mockResolvedValueOnce({
      id: STEP_ID,
      organizationId: ORG_ID,
      status: 'PENDING',
      approverUserId: USER_ID,
      approvalFlowId: FLOW_ID,
      approvalFlow: { resourceId: INV_ID, createdByUserId: 'other-user' },
    });
    mockPrisma.approvalStep.findUniqueOrThrow.mockResolvedValueOnce({
      id: STEP_ID,
      status: 'REJECTED',
    });
    mockPrisma.invoice.findUnique.mockResolvedValue({
      id: INV_ID,
      invoiceNumber: 'INV-9',
    });
    mockPrisma.approvalFlow.findUnique.mockResolvedValue({
      createdByUserId: submitterId,
    });

    await caller.reject({ stepId: STEP_ID, comment: REJECT_COMMENT });

    expect(vi.mocked(dispatch)).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        type: 'APPROVAL_DECISION',
        recipientUserIds: [submitterId],
        metadata: expect.objectContaining({ decision: 'rejected' }),
      }),
    );
  });
});

describe('approval router — delegate', () => {
  it('delegate throws BAD_REQUEST when target is not an org member', async () => {
    mockPrisma.approvalStep.findFirst.mockResolvedValueOnce({
      id: STEP_ID,
      organizationId: ORG_ID,
      status: 'PENDING',
      approverUserId: USER_ID,
      approvalFlowId: FLOW_ID,
    });
    mockPrisma.member.findFirst.mockResolvedValueOnce(null);

    await expect(
      caller.delegate({
        stepId: STEP_ID,
        delegateToUserId: DELEGATE_USER_ID,
        comment: 'delegating',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('delegate reassigns approver and invalidates dashboard cache', async () => {
    mockPrisma.approvalStep.findFirst.mockResolvedValueOnce({
      id: STEP_ID,
      organizationId: ORG_ID,
      status: 'PENDING',
      approverUserId: USER_ID,
      approvalFlowId: FLOW_ID,
      approvalFlow: { resourceId: INV_ID },
    });
    mockPrisma.member.findFirst.mockResolvedValueOnce({ userId: DELEGATE_USER_ID });
    mockPrisma.approvalStep.update.mockResolvedValueOnce({
      id: STEP_ID,
      approverUserId: DELEGATE_USER_ID,
    });

    const out = await caller.delegate({
      stepId: STEP_ID,
      delegateToUserId: DELEGATE_USER_ID,
    });

    expect(mockPrisma.approvalDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ decision: 'DELEGATE' }),
      }),
    );
    expect(out).toMatchObject({ approverUserId: DELEGATE_USER_ID });
    expect(invalidateByPrefix).toHaveBeenCalledWith(`dash:${ORG_ID}`);
  });
});

describe('approval router — requestClarification', () => {
  it('returns step when clarification is recorded', async () => {
    const stepRow = {
      id: STEP_ID,
      organizationId: ORG_ID,
      status: 'PENDING',
      approverUserId: USER_ID,
    };
    mockPrisma.approvalStep.findFirst.mockResolvedValueOnce(stepRow);

    const out = await caller.requestClarification({
      stepId: STEP_ID,
      comment: 'need more detail here',
    });

    expect(mockPrisma.approvalDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ decision: 'REQUEST_CHANGES' }),
      }),
    );
    expect(out).toEqual(stepRow);
  });
});

describe('approval router — bulkApprove / bulkReject', () => {
  it('bulkApprove aggregates success and failure per step', async () => {
    mockPrisma.approvalStep.findFirst.mockImplementation(
      async (args: { where: { id: string } }) => {
        if (args.where.id === STEP_ID) {
          return {
            id: STEP_ID,
            organizationId: ORG_ID,
            status: 'PENDING',
            approverUserId: USER_ID,
            approvalFlowId: FLOW_ID,
            approvalFlow: { resourceId: INV_ID },
          };
        }
        return null;
      },
    );

    const res = await caller.bulkApprove({ stepIds: [STEP_ID, STEP_ID_2] });

    expect(res.succeeded).toBe(1);
    expect(res.failed).toBe(1);
    expect(res.errors.some(e => e.includes(STEP_ID_2))).toBe(true);
    expect(invalidateByPrefix).toHaveBeenCalledWith(`dash:${ORG_ID}`);
  });

  it('bulkReject aggregates success and failure per step', async () => {
    mockPrisma.approvalStep.findFirst.mockImplementation(
      async (args: { where: { id: string } }) => {
        if (args.where.id === STEP_ID) {
          return {
            id: STEP_ID,
            organizationId: ORG_ID,
            status: 'PENDING',
            approverUserId: USER_ID,
            approvalFlowId: FLOW_ID,
            approvalFlow: { resourceId: INV_ID },
          };
        }
        return null;
      },
    );

    const res = await caller.bulkReject({
      stepIds: [STEP_ID, STEP_ID_2],
      comment: REJECT_COMMENT,
    });

    expect(res.succeeded).toBe(1);
    expect(res.failed).toBe(1);
    expect(invalidateByPrefix).toHaveBeenCalledWith(`dash:${ORG_ID}`);
  });
});

describe('approval router — submitForApproval', () => {
  it('throws NOT_FOUND when invoice is missing', async () => {
    await expect(caller.submitForApproval({ invoiceId: INV_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('throws BAD_REQUEST when invoice is not matched', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValueOnce({
      id: INV_ID,
      organizationId: ORG_ID,
      deletedAt: null,
      matchStatus: 'UNMATCHED',
      status: 'DRAFT',
    });

    await expect(caller.submitForApproval({ invoiceId: INV_ID })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('throws BAD_REQUEST when invoice is already approval pending', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValueOnce({
      id: INV_ID,
      organizationId: ORG_ID,
      deletedAt: null,
      matchStatus: 'MATCHED',
      status: 'APPROVAL_PENDING',
    });

    await expect(caller.submitForApproval({ invoiceId: INV_ID })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('throws BAD_REQUEST when no chain matches', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValueOnce({
      id: INV_ID,
      organizationId: ORG_ID,
      deletedAt: null,
      matchStatus: 'MATCHED',
      status: 'DRAFT',
      totalMinor: 1000,
    });
    vi.mocked(routeToChain).mockResolvedValueOnce(null);

    await expect(caller.submitForApproval({ invoiceId: INV_ID })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('creates flow and sets invoice to APPROVAL_PENDING', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValueOnce({
      id: INV_ID,
      organizationId: ORG_ID,
      deletedAt: null,
      matchStatus: 'MATCHED',
      status: 'DRAFT',
      totalMinor: 1000,
      contractorId: null,
      invoiceNumber: 'INV-88',
      currency: 'PLN',
    });
    vi.mocked(routeToChain).mockResolvedValueOnce({
      id: CHAIN_ID,
      stepsJson: [],
    } as never);
    vi.mocked(createApprovalFlow).mockResolvedValueOnce({
      id: FLOW_ID,
      steps: [],
    } as never);

    const out = await caller.submitForApproval({ invoiceId: INV_ID });

    expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INV_ID },
        data: { status: 'APPROVAL_PENDING' },
      }),
    );
    expect(out).toMatchObject({ id: FLOW_ID });
  });
});

describe('approval router — getAuditTrail', () => {
  it('returns empty events when no approval flow exists', async () => {
    const res = await caller.getAuditTrail({ invoiceId: INV_ID });

    expect(res).toEqual({ events: [], flow: null });
  });

  it('returns submitted system event for a minimal flow', async () => {
    const started = new Date('2024-06-01T12:00:00.000Z');
    mockPrisma.approvalFlow.findFirst.mockResolvedValueOnce({
      id: FLOW_ID,
      resourceId: INV_ID,
      organizationId: ORG_ID,
      status: 'PENDING',
      chainConfigId: null,
      currentStepOrder: 1,
      startedAt: started,
      completedAt: null,
      steps: [],
    });

    const res = await caller.getAuditTrail({ invoiceId: INV_ID });

    expect(res.flow).toMatchObject({ id: FLOW_ID, chainName: null });
    expect(res.events.some(e => (e as { label?: string }).label === 'submitted')).toBe(true);
  });
});

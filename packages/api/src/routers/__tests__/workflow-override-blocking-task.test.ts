/**
 * overrideBlockingTask mutation tests.
 *
 * Drives the real `workflowExecutionRouter.overrideBlockingTask` mutation
 * through a tRPC caller (createCallerFactory) so the assertions exercise the
 * router itself: RBAC gate, the single-transaction skip + override-metadata +
 * audit-log write, and the PRECONDITION_FAILED guard when no IP_VERIFICATION
 * task is open.
 *
 * The Zod input contract (reason min 20 + acknowledged literal true) is
 * verified by calling the mutation with invalid inputs and asserting the
 * boundary rejects before any DB work runs.
 */

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Prisma via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, ORG_ID, USER_ID, RUN_ID } = vi.hoisted(() => {
  const ORG_ID = 'org-wfoverride-001';
  const USER_ID = 'user-wfoverride-001';
  const RUN_ID = 'run-override-001';
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    workflowRun: {
      findFirst: vi.fn(),
      update: vi.fn(async () => ({})),
    },
    workflowTaskRun: {
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    auditLog: {
      create: vi.fn(async () => ({})),
    },
    member: {
      findFirst: vi.fn().mockResolvedValue({ role: 'admin', userId: USER_ID }),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma, ORG_ID, USER_ID, RUN_ID };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const { hasPermissionMock } = vi.hoisted(() => ({
  hasPermissionMock: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: hasPermissionMock,
    },
  },
  authApi: {
    hasPermission: hasPermissionMock,
  },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
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

vi.mock('../../services/org-cache', () => ({
  getOrgMeta: vi.fn(async (orgId: string) => ({
    id: orgId,
    dataRegion: 'EU',
    status: 'ACTIVE',
    name: 'Test Org',
  })),
  invalidateOrgMeta: vi.fn(async () => undefined),
  ORG_META_TTL_SECONDS: 300,
  orgMetaKey: (orgId: string) => `org:${orgId}:meta`,
}));

vi.mock('../../services/notification-service', () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/equipment-workflow', () => ({
  checkShipmentTaskCompletion: vi.fn(async () => undefined),
  handleEquipmentTaskStart: vi.fn(async () => undefined),
}));

vi.mock('../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: { dashboardPrefix: (orgId: string) => `dashboard:${orgId}` },
  CacheTTL: {},
}));

vi.mock('../../services/jira-issue-sync', () => ({
  createJiraIssue: vi.fn(async () => undefined),
  transitionJiraIssue: vi.fn(async () => undefined),
}));

vi.mock('../../services/linear-issue-sync', () => ({
  createLinearIssue: vi.fn(async () => undefined),
  syncTaskStatusToLinear: vi.fn(async () => undefined),
}));

vi.mock('../../services/calendar-deadline-sync', () => ({
  createTaskCalendarEvent: vi.fn(async () => undefined),
}));

vi.mock('@sentry/node', () => {
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
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
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
  createIntegrationLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init';
import { workflowExecutionRouter } from '../workflow/workflow-execution';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(workflowExecutionRouter);

function makeCaller(userId = USER_ID, orgId = ORG_ID) {
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

const caller = makeCaller();

const VALID_REASON = 'Departing contractor confirmed IP returned out of band';

beforeEach(() => {
  vi.clearAllMocks();
  hasPermissionMock.mockResolvedValue({ success: true });
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockPrisma),
  );
});

describe('overrideBlockingTask', () => {
  // =========================================================================
  // RBAC gate — requirePermission({ workflow: ['override_blocking_task'] })
  // =========================================================================

  it('rejects FORBIDDEN when the caller lacks workflow:override_blocking_task', async () => {
    hasPermissionMock.mockResolvedValueOnce({ success: false });

    await expect(
      caller.overrideBlockingTask({
        workflowRunId: RUN_ID,
        reason: VALID_REASON,
        acknowledged: true,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    // Gate runs before any DB work.
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.workflowTaskRun.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('requires it to be the permission gate — checks override_blocking_task scope', async () => {
    hasPermissionMock.mockResolvedValueOnce({ success: false });

    await caller
      .overrideBlockingTask({ workflowRunId: RUN_ID, reason: VALID_REASON, acknowledged: true })
      .catch(() => undefined);

    expect(hasPermissionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { permissions: { workflow: ['override_blocking_task'] } },
      }),
    );
  });

  // =========================================================================
  // Happy path — single $transaction: skip + override metadata + audit
  // =========================================================================

  it('skips open IP_VERIFICATION tasks, writes overrideMetadata + AuditLog in one $transaction', async () => {
    mockPrisma.workflowRun.findFirst.mockResolvedValueOnce({
      id: RUN_ID,
      overrideMetadata: null,
    });
    mockPrisma.workflowTaskRun.findMany.mockResolvedValueOnce([
      { id: 'ip-task-1' },
      { id: 'ip-task-2' },
    ]);

    const result = await caller.overrideBlockingTask({
      workflowRunId: RUN_ID,
      reason: VALID_REASON,
      acknowledged: true,
    });

    // Open IP_VERIFICATION tasks were looked up org-scoped and SKIPPED.
    const findManyCall = mockPrisma.workflowTaskRun.findMany.mock.calls[0]?.[0];
    expect(findManyCall.where).toMatchObject({
      workflowRunId: RUN_ID,
      organizationId: ORG_ID,
      taskType: 'IP_VERIFICATION',
      status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
    });

    const skipCall = mockPrisma.workflowTaskRun.updateMany.mock.calls[0]?.[0];
    expect(skipCall.where.id.in).toEqual(['ip-task-1', 'ip-task-2']);
    expect(skipCall.data.status).toBe('SKIPPED');
    expect(skipCall.data.resultJson).toMatchObject({
      skipReason: 'OVERRIDDEN_BY_OWNER',
      overriddenByUserId: USER_ID,
      reason: VALID_REASON,
    });

    // Override metadata written onto the run. The recompute postlude issues its
    // own workflowRun.update per skipped task, so select the override write by
    // its distinguishing data (overrideMetadata) rather than by call index.
    const runUpdate = mockPrisma.workflowRun.update.mock.calls.find(
      (call: [{ data?: Record<string, unknown> }]) => 'overrideMetadata' in (call[0]?.data ?? {}),
    )?.[0];
    expect(runUpdate).toBeDefined();
    expect(runUpdate.where).toEqual({ id: RUN_ID });
    expect(runUpdate.data.overriddenByUserId).toBe(USER_ID);
    expect(runUpdate.data.overriddenAt).toBeInstanceOf(Date);
    expect(runUpdate.data.overrideMetadata).toMatchObject({
      reason: VALID_REASON,
      acknowledged: true,
      overriddenByUserId: USER_ID,
      blockedTaskKind: 'IP_VERIFICATION',
    });

    // Audit row written through the real audit-writer onto the tx client
    // (writeAuditLog maps `newValues` -> `newValuesJson`).
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
    const auditData = mockPrisma.auditLog.create.mock.calls[0]?.[0]?.data;
    expect(auditData).toMatchObject({
      organizationId: ORG_ID,
      actorType: 'USER',
      actorId: USER_ID,
      action: 'workflow.offboarding.override_blocking_task',
      resourceType: 'WORKFLOW_RUN',
      resourceId: RUN_ID,
    });
    expect((auditData.newValuesJson as { skippedTaskIds: string[] }).skippedTaskIds).toEqual([
      'ip-task-1',
      'ip-task-2',
    ]);

    // The skip, override-metadata, and audit writes all happened inside a
    // single $transaction.
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    expect(result).toMatchObject({
      workflowRunId: RUN_ID,
      overrideMetadata: { blockedTaskKind: 'IP_VERIFICATION' },
    });
  });

  // =========================================================================
  // Guards
  // =========================================================================

  it('throws NOT_FOUND when the workflow run does not exist in the org', async () => {
    mockPrisma.workflowRun.findFirst.mockResolvedValueOnce(null);

    await expect(
      caller.overrideBlockingTask({
        workflowRunId: RUN_ID,
        reason: VALID_REASON,
        acknowledged: true,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    expect(mockPrisma.workflowTaskRun.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('throws PRECONDITION_FAILED when no IP_VERIFICATION task is open', async () => {
    mockPrisma.workflowRun.findFirst.mockResolvedValueOnce({
      id: RUN_ID,
      overrideMetadata: null,
    });
    mockPrisma.workflowTaskRun.findMany.mockResolvedValueOnce([]);

    await expect(
      caller.overrideBlockingTask({
        workflowRunId: RUN_ID,
        reason: VALID_REASON,
        acknowledged: true,
      }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });

    // Nothing was skipped or audited when the precondition fails.
    expect(mockPrisma.workflowTaskRun.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.workflowRun.update).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Zod input contract — server-side validation is the gate
  // =========================================================================

  it('rejects a reason shorter than 20 chars before any DB work', async () => {
    await expect(
      caller.overrideBlockingTask({
        workflowRunId: RUN_ID,
        reason: 'too short',
        acknowledged: true,
      }),
    ).rejects.toBeInstanceOf(TRPCError);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects acknowledged=false before any DB work', async () => {
    await expect(
      caller.overrideBlockingTask({
        workflowRunId: RUN_ID,
        reason: VALID_REASON,
        acknowledged: false as never,
      }),
    ).rejects.toBeInstanceOf(TRPCError);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an empty workflowRunId before any DB work', async () => {
    await expect(
      caller.overrideBlockingTask({
        workflowRunId: '',
        reason: VALID_REASON,
        acknowledged: true,
      }),
    ).rejects.toBeInstanceOf(TRPCError);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

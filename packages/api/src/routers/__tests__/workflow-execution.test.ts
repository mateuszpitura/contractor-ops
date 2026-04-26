/**
 * Workflow execution router unit tests.
 *
 * Tests cancelRun, getRun, listRuns, myTasks, completeTask, skipTask,
 * reassignTask, addComment, listComments, and overdueCount procedures.
 *
 * Note: startRun is intentionally tested lightly due to its deep transactional
 * nesting and many fire-and-forget side effects. Full startRun integration
 * is covered in workflow.test.ts and integration tests.
 */

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Prisma via vi.hoisted (constants defined here to avoid TDZ errors)
// ---------------------------------------------------------------------------

const { mockPrisma, ORG_ID, USER_ID, RUN_ID, TASK_RUN_ID, TEMPLATE_ID, CONTRACTOR_ID } = vi.hoisted(
  () => {
    const ORG_ID = 'org-wfexec-001';
    const USER_ID = 'user-wfexec-001';
    const RUN_ID = 'run-001';
    const TASK_RUN_ID = 'taskrun-001';
    const TEMPLATE_ID = 'tmpl-001';
    const CONTRACTOR_ID = 'contractor-001';
    type Rec = Record<string, unknown>;

    const mockPrisma: Rec = {
      organization: {
        findUnique: vi.fn().mockResolvedValue({ dataRegion: 'EU' }),
      },
      workflowTemplate: {
        findFirst: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
      workflowTaskTemplate: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      workflowRun: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      workflowTaskRun: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
      },
      workflowComment: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      contractor: {
        findFirst: vi.fn(),
      },
      contract: {
        findFirst: vi.fn(),
      },
      member: {
        findFirst: vi.fn().mockResolvedValue({ role: 'admin', userId: USER_ID }),
      },
      integrationConnection: {
        findFirst: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (fnOrArray: ((tx: Rec) => Promise<unknown>) | unknown[]) => {
        if (typeof fnOrArray === 'function') return fnOrArray(mockPrisma);
        return Promise.all(fnOrArray);
      }),
    };

    return { mockPrisma, ORG_ID, USER_ID, RUN_ID, TASK_RUN_ID, TEMPLATE_ID, CONTRACTOR_ID };
  },
);

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

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

vi.mock('../../services/notification-service.js', () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/equipment-workflow.js', () => ({
  checkShipmentTaskCompletion: vi.fn(async () => undefined),
  handleEquipmentTaskStart: vi.fn(async () => undefined),
}));

vi.mock('../../services/cache.js', () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: { dashboardPrefix: (orgId: string) => `dashboard:${orgId}` },
  CacheTTL: {},
}));

vi.mock('../../services/jira-issue-sync.js', () => ({
  createJiraIssue: vi.fn(async () => undefined),
  transitionJiraIssue: vi.fn(async () => undefined),
}));

vi.mock('../../services/linear-issue-sync.js', () => ({
  createLinearIssue: vi.fn(async () => undefined),
  syncTaskStatusToLinear: vi.fn(async () => undefined),
}));

vi.mock('../../services/calendar-deadline-sync.js', () => ({
  createTaskCalendarEvent: vi.fn(async () => undefined),
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init.js';
import { workflowExecutionRouter } from '../workflow-execution.js';

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

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(
    async (fnOrArray: ((tx: unknown) => Promise<unknown>) | unknown[]) => {
      if (typeof fnOrArray === 'function') return fnOrArray(mockPrisma);
      return Promise.all(fnOrArray);
    },
  );
});

// ===========================================================================
// Tests
// ===========================================================================

describe('workflowExecutionRouter', () => {
  // =========================================================================
  // cancelRun
  // =========================================================================

  describe('cancelRun', () => {
    it('cancels a run and sets all non-terminal tasks to CANCELLED', async () => {
      mockPrisma.workflowRun.findFirst.mockResolvedValueOnce({
        id: RUN_ID,
        organizationId: ORG_ID,
        status: 'IN_PROGRESS',
      });
      mockPrisma.workflowTaskRun.updateMany.mockResolvedValueOnce({ count: 3 });
      mockPrisma.workflowRun.update.mockResolvedValueOnce({
        id: RUN_ID,
        status: 'CANCELLED',
        cancelledAt: expect.any(Date),
        tasks: [{ id: 'task-1', status: 'CANCELLED', externalRefType: null, externalRefId: null }],
      });

      const result = await caller.cancelRun({ runId: RUN_ID, reason: 'No longer needed' });

      expect(result).toMatchObject({ id: RUN_ID, status: 'CANCELLED' });

      const updateManyCall = mockPrisma.workflowTaskRun.updateMany.mock.calls[0]?.[0];
      expect(updateManyCall.where.status).toEqual({ in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] });
      expect(updateManyCall.data.status).toBe('CANCELLED');
    });

    it('throws NOT_FOUND when run does not exist', async () => {
      mockPrisma.workflowRun.findFirst.mockResolvedValueOnce(null);

      await expect(caller.cancelRun({ runId: 'nonexistent' })).rejects.toThrow(TRPCError);
    });

    it('throws BAD_REQUEST when run is already completed', async () => {
      mockPrisma.workflowRun.findFirst.mockResolvedValueOnce({
        id: RUN_ID,
        organizationId: ORG_ID,
        status: 'COMPLETED',
      });

      await expect(caller.cancelRun({ runId: RUN_ID })).rejects.toThrow(TRPCError);
    });

    it('throws BAD_REQUEST when run is already cancelled', async () => {
      mockPrisma.workflowRun.findFirst.mockResolvedValueOnce({
        id: RUN_ID,
        organizationId: ORG_ID,
        status: 'CANCELLED',
      });

      await expect(caller.cancelRun({ runId: RUN_ID })).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // getRun
  // =========================================================================

  describe('getRun', () => {
    it('returns run with tasks, comments, template, contractor, and contract', async () => {
      const now = new Date();
      mockPrisma.workflowRun.findFirst.mockResolvedValueOnce({
        id: RUN_ID,
        organizationId: ORG_ID,
        status: 'IN_PROGRESS',
        tasks: [
          { id: 'task-1', status: 'TODO', dueAt: new Date(now.getTime() + 86400000) },
          { id: 'task-2', status: 'DONE', dueAt: null },
        ],
        comments: [],
        workflowTemplate: { id: TEMPLATE_ID, name: 'Onboarding', type: 'ONBOARDING' },
        contractor: {
          id: CONTRACTOR_ID,
          legalName: 'Test Corp',
          displayName: null,
          status: 'ACTIVE',
        },
        contract: null,
      });

      const result = await caller.getRun({ id: RUN_ID });

      expect(result).toMatchObject({ id: RUN_ID, status: 'IN_PROGRESS' });
      expect(result.tasks).toHaveLength(2);

      const call = mockPrisma.workflowRun.findFirst.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({ id: RUN_ID, organizationId: ORG_ID });
      expect(call.include.tasks).toBeDefined();
      expect(call.include.comments).toBeDefined();
    });

    it('adds isOverdue field to tasks', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      mockPrisma.workflowRun.findFirst.mockResolvedValueOnce({
        id: RUN_ID,
        organizationId: ORG_ID,
        status: 'IN_PROGRESS',
        tasks: [
          { id: 'task-1', status: 'TODO', dueAt: pastDate },
          { id: 'task-2', status: 'DONE', dueAt: pastDate },
        ],
        comments: [],
        workflowTemplate: { id: TEMPLATE_ID, name: 'Onboarding', type: 'ONBOARDING' },
        contractor: { id: CONTRACTOR_ID, legalName: 'Test', displayName: null, status: 'ACTIVE' },
        contract: null,
      });

      const result = await caller.getRun({ id: RUN_ID });

      // TODO task with past due date is overdue
      expect(result.tasks[0].isOverdue).toBe(true);
      // DONE task is not overdue even with past due date
      expect(result.tasks[1].isOverdue).toBe(false);
    });

    it('throws NOT_FOUND when run does not exist', async () => {
      mockPrisma.workflowRun.findFirst.mockResolvedValueOnce(null);

      await expect(caller.getRun({ id: 'nonexistent' })).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // listRuns
  // =========================================================================

  describe('listRuns', () => {
    it('queries with organization scope and pagination', async () => {
      mockPrisma.workflowRun.findMany.mockResolvedValueOnce([]);
      mockPrisma.workflowRun.count.mockResolvedValueOnce(0);

      const result = await caller.listRuns({ page: 1, pageSize: 20 });

      expect(result).toMatchObject({ items: [], total: 0, page: 1, pageSize: 20 });

      const findCall = mockPrisma.workflowRun.findMany.mock.calls[0]?.[0];
      expect(findCall.where).toMatchObject({ organizationId: ORG_ID });
      expect(findCall.skip).toBe(0);
      expect(findCall.take).toBe(20);
    });

    it('applies contractorId filter', async () => {
      mockPrisma.workflowRun.findMany.mockResolvedValueOnce([]);
      mockPrisma.workflowRun.count.mockResolvedValueOnce(0);

      await caller.listRuns({ page: 1, pageSize: 20, contractorId: CONTRACTOR_ID });

      const findCall = mockPrisma.workflowRun.findMany.mock.calls[0]?.[0];
      expect(findCall.where.contractorId).toBe(CONTRACTOR_ID);
    });

    it('applies status filter', async () => {
      mockPrisma.workflowRun.findMany.mockResolvedValueOnce([]);
      mockPrisma.workflowRun.count.mockResolvedValueOnce(0);

      await caller.listRuns({
        page: 1,
        pageSize: 20,
        filters: { status: ['IN_PROGRESS', 'COMPLETED'] },
      });

      const findCall = mockPrisma.workflowRun.findMany.mock.calls[0]?.[0];
      expect(findCall.where.status).toEqual({ in: ['IN_PROGRESS', 'COMPLETED'] });
    });
  });

  // =========================================================================
  // myTasks
  // =========================================================================

  describe('myTasks', () => {
    it('queries tasks assigned to current user with active statuses', async () => {
      mockPrisma.workflowTaskRun.findMany.mockResolvedValueOnce([]);
      mockPrisma.workflowTaskRun.count.mockResolvedValueOnce(0);

      const result = await caller.myTasks({ page: 1, pageSize: 20 });

      expect(result).toMatchObject({ items: [], total: 0 });

      const findCall = mockPrisma.workflowTaskRun.findMany.mock.calls[0]?.[0];
      expect(findCall.where).toMatchObject({
        organizationId: ORG_ID,
        assigneeUserId: USER_ID,
        status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
      });
    });

    it('applies overdueOnly filter', async () => {
      mockPrisma.workflowTaskRun.findMany.mockResolvedValueOnce([]);
      mockPrisma.workflowTaskRun.count.mockResolvedValueOnce(0);

      await caller.myTasks({ page: 1, pageSize: 20, overdueOnly: true });

      const findCall = mockPrisma.workflowTaskRun.findMany.mock.calls[0]?.[0];
      expect(findCall.where.dueAt).toBeDefined();
    });
  });

  // =========================================================================
  // completeTask
  // =========================================================================

  describe('completeTask', () => {
    it('marks task as DONE, unblocks dependents, and recomputes progress', async () => {
      mockPrisma.workflowTaskRun.findFirst.mockResolvedValueOnce({
        id: TASK_RUN_ID,
        organizationId: ORG_ID,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        externalRefType: null,
        externalRefId: null,
        workflowRun: { id: RUN_ID, status: 'IN_PROGRESS' },
      });
      mockPrisma.workflowTaskRun.update.mockResolvedValueOnce({
        id: TASK_RUN_ID,
        status: 'DONE',
        externalRefType: null,
        externalRefId: null,
      });
      mockPrisma.workflowTaskRun.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.workflowTaskRun.findMany.mockResolvedValueOnce([
        { status: 'DONE', resultJson: null },
        { status: 'TODO', resultJson: null },
      ]);
      mockPrisma.workflowRun.update.mockResolvedValueOnce({});

      const result = await caller.completeTask({ taskRunId: TASK_RUN_ID });

      expect(result).toMatchObject({ id: TASK_RUN_ID, status: 'DONE' });

      const updateCall = mockPrisma.workflowTaskRun.update.mock.calls[0]?.[0];
      expect(updateCall.data.status).toBe('DONE');
      expect(updateCall.data.completedAt).toBeInstanceOf(Date);
      expect(updateCall.data.completedByUserId).toBe(USER_ID);
    });

    it('throws NOT_FOUND when task does not exist', async () => {
      mockPrisma.workflowTaskRun.findFirst.mockResolvedValueOnce(null);

      await expect(caller.completeTask({ taskRunId: 'nonexistent' })).rejects.toThrow(TRPCError);
    });

    it('throws BAD_REQUEST when task status does not allow DONE transition', async () => {
      mockPrisma.workflowTaskRun.findFirst.mockResolvedValueOnce({
        id: TASK_RUN_ID,
        organizationId: ORG_ID,
        status: 'DONE',
        workflowRun: { id: RUN_ID, status: 'IN_PROGRESS' },
      });

      await expect(caller.completeTask({ taskRunId: TASK_RUN_ID })).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // skipTask
  // =========================================================================

  describe('skipTask', () => {
    it('marks task as SKIPPED with reason and unblocks dependents', async () => {
      mockPrisma.workflowTaskRun.findFirst.mockResolvedValueOnce({
        id: TASK_RUN_ID,
        organizationId: ORG_ID,
        status: 'TODO',
        externalRefType: null,
        externalRefId: null,
        workflowRun: { id: RUN_ID, status: 'IN_PROGRESS' },
      });
      mockPrisma.workflowTaskRun.update.mockResolvedValueOnce({
        id: TASK_RUN_ID,
        status: 'SKIPPED',
        externalRefType: null,
        externalRefId: null,
      });
      mockPrisma.workflowTaskRun.updateMany.mockResolvedValueOnce({ count: 0 });
      mockPrisma.workflowTaskRun.findMany.mockResolvedValueOnce([
        { status: 'SKIPPED', resultJson: { skipReason: 'Not applicable' } },
        { status: 'DONE', resultJson: null },
      ]);
      mockPrisma.workflowRun.update.mockResolvedValueOnce({});

      const result = await caller.skipTask({
        taskRunId: TASK_RUN_ID,
        reason: 'Not applicable',
      });

      expect(result).toMatchObject({ id: TASK_RUN_ID, status: 'SKIPPED' });

      const updateCall = mockPrisma.workflowTaskRun.update.mock.calls[0]?.[0];
      expect(updateCall.data.resultJson).toEqual({ skipReason: 'Not applicable' });
    });

    it('throws NOT_FOUND when task does not exist', async () => {
      mockPrisma.workflowTaskRun.findFirst.mockResolvedValueOnce(null);

      await expect(caller.skipTask({ taskRunId: 'nonexistent', reason: 'test' })).rejects.toThrow(
        TRPCError,
      );
    });
  });

  // =========================================================================
  // reassignTask
  // =========================================================================

  describe('reassignTask', () => {
    it('updates task assignee and dispatches notification', async () => {
      mockPrisma.workflowTaskRun.findFirst.mockResolvedValueOnce({
        id: TASK_RUN_ID,
        organizationId: ORG_ID,
        status: 'TODO',
      });
      mockPrisma.workflowTaskRun.update.mockResolvedValueOnce({
        id: TASK_RUN_ID,
        title: 'Setup IT Access',
        assigneeUserId: 'new-user-1',
        workflowRun: {
          id: RUN_ID,
          workflowTemplate: { name: 'Onboarding' },
          contractor: { legalName: 'Test Corp', displayName: null },
        },
      });

      const result = await caller.reassignTask({
        taskRunId: TASK_RUN_ID,
        newAssigneeUserId: 'new-user-1',
      });

      expect(result).toMatchObject({ id: TASK_RUN_ID, assigneeUserId: 'new-user-1' });

      const updateCall = mockPrisma.workflowTaskRun.update.mock.calls[0]?.[0];
      expect(updateCall.data.assigneeUserId).toBe('new-user-1');
    });

    it('throws NOT_FOUND when task does not exist', async () => {
      mockPrisma.workflowTaskRun.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.reassignTask({ taskRunId: 'nonexistent', newAssigneeUserId: 'user-x' }),
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // addComment
  // =========================================================================

  describe('addComment', () => {
    it('creates a comment on a workflow run', async () => {
      mockPrisma.workflowRun.findFirst.mockResolvedValueOnce({
        id: RUN_ID,
        organizationId: ORG_ID,
      });
      mockPrisma.workflowComment.create.mockResolvedValueOnce({
        id: 'comment-1',
        workflowRunId: RUN_ID,
        body: 'Looks good',
        author: { id: USER_ID, name: 'Test User', image: null },
      });

      const result = await caller.addComment({
        workflowRunId: RUN_ID,
        body: 'Looks good',
      });

      expect(result).toMatchObject({ id: 'comment-1', body: 'Looks good' });

      const createCall = mockPrisma.workflowComment.create.mock.calls[0]?.[0];
      expect(createCall.data).toMatchObject({
        organizationId: ORG_ID,
        workflowRunId: RUN_ID,
        authorUserId: USER_ID,
        body: 'Looks good',
      });
    });

    it('throws NOT_FOUND when run does not exist', async () => {
      mockPrisma.workflowRun.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.addComment({ workflowRunId: 'nonexistent', body: 'test' }),
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // listComments
  // =========================================================================

  describe('listComments', () => {
    it('returns comments for a workflow run', async () => {
      mockPrisma.workflowComment.findMany.mockResolvedValueOnce([
        { id: 'c1', body: 'First comment', author: { id: USER_ID, name: 'User', image: null } },
      ]);

      const result = await caller.listComments({ workflowRunId: RUN_ID });

      expect(result).toHaveLength(1);

      const call = mockPrisma.workflowComment.findMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        organizationId: ORG_ID,
        workflowRunId: RUN_ID,
      });
    });

    it('filters by task run ID when provided', async () => {
      mockPrisma.workflowComment.findMany.mockResolvedValueOnce([]);

      await caller.listComments({
        workflowRunId: RUN_ID,
        workflowTaskRunId: TASK_RUN_ID,
      });

      const call = mockPrisma.workflowComment.findMany.mock.calls[0]?.[0];
      expect(call.where.workflowTaskRunId).toBe(TASK_RUN_ID);
    });
  });

  // =========================================================================
  // overdueCount
  // =========================================================================

  describe('overdueCount', () => {
    it('counts overdue tasks for the current user', async () => {
      mockPrisma.workflowTaskRun.count.mockResolvedValueOnce(5);

      const result = await caller.overdueCount();

      expect(result).toEqual({ count: 5 });

      const call = mockPrisma.workflowTaskRun.count.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        organizationId: ORG_ID,
        assigneeUserId: USER_ID,
        status: { in: ['TODO', 'IN_PROGRESS'] },
      });
      expect(call.where.dueAt).toBeDefined();
    });

    it('returns zero when no overdue tasks exist', async () => {
      mockPrisma.workflowTaskRun.count.mockResolvedValueOnce(0);

      const result = await caller.overdueCount();

      expect(result).toEqual({ count: 0 });
    });
  });

  // =========================================================================
  // startRun
  // =========================================================================

  describe('startRun', () => {
    it('throws NOT_FOUND when template does not exist', async () => {
      mockPrisma.workflowTemplate.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.startRun({ templateId: 'nonexistent', contractorId: CONTRACTOR_ID }),
      ).rejects.toThrow(TRPCError);
    });

    it('throws NOT_FOUND when contractor does not exist', async () => {
      mockPrisma.workflowTemplate.findFirst.mockResolvedValueOnce({
        id: TEMPLATE_ID,
        organizationId: ORG_ID,
        status: 'ACTIVE',
        type: 'ONBOARDING',
        tasks: [],
      });
      mockPrisma.contractor.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.startRun({ templateId: TEMPLATE_ID, contractorId: 'nonexistent' }),
      ).rejects.toThrow(TRPCError);
    });

    it('creates a workflow run with tasks and returns it', async () => {
      const now = new Date();
      mockPrisma.workflowTemplate.findFirst.mockResolvedValueOnce({
        id: TEMPLATE_ID,
        organizationId: ORG_ID,
        status: 'ACTIVE',
        type: 'ONBOARDING',
        name: 'Onboarding',
        tasks: [
          {
            id: 'tmpl-task-1',
            title: 'Setup Access',
            description: null,
            taskType: 'STANDARD',
            required: true,
            assigneeMode: 'MANUAL',
            assigneeRole: null,
            assigneeUserId: USER_ID,
            dueOffsetDays: 3,
            dueOffsetHours: null,
            dependsOnTaskTemplateId: null,
            sortOrder: 1,
            configJson: null,
          },
        ],
      });
      mockPrisma.contractor.findFirst.mockResolvedValueOnce({
        id: CONTRACTOR_ID,
        organizationId: ORG_ID,
        legalName: 'Test Corp',
        displayName: null,
        deletedAt: null,
      });
      mockPrisma.workflowRun.create.mockResolvedValueOnce({
        id: RUN_ID,
        organizationId: ORG_ID,
        status: 'IN_PROGRESS',
        contractorId: CONTRACTOR_ID,
      });
      mockPrisma.workflowTaskRun.create.mockResolvedValueOnce({
        id: TASK_RUN_ID,
        status: 'TODO',
        title: 'Setup Access',
        description: null,
        assigneeUserId: USER_ID,
      });
      mockPrisma.workflowTaskRun.findMany.mockResolvedValueOnce([
        { status: 'TODO', resultJson: null },
      ]);
      mockPrisma.workflowRun.update.mockResolvedValueOnce({});
      mockPrisma.workflowRun.findUniqueOrThrow.mockResolvedValueOnce({
        id: RUN_ID,
        status: 'IN_PROGRESS',
        contractorId: CONTRACTOR_ID,
        workflowTemplate: { name: 'Onboarding', type: 'ONBOARDING' },
        tasks: [
          {
            id: TASK_RUN_ID,
            status: 'TODO',
            title: 'Setup Access',
            assigneeUserId: USER_ID,
            externalRefType: null,
            externalRefId: null,
          },
        ],
      });

      const result = await caller.startRun({
        templateId: TEMPLATE_ID,
        contractorId: CONTRACTOR_ID,
      });

      expect(result).toMatchObject({ id: RUN_ID, status: 'IN_PROGRESS' });
      expect(mockPrisma.workflowRun.create).toHaveBeenCalled();
      expect(mockPrisma.workflowTaskRun.create).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // completeTask — auto-complete run
  // =========================================================================

  describe('completeTask — run auto-completion', () => {
    it('marks the run as COMPLETED when all tasks are done', async () => {
      mockPrisma.workflowTaskRun.findFirst.mockResolvedValueOnce({
        id: TASK_RUN_ID,
        organizationId: ORG_ID,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        externalRefType: null,
        externalRefId: null,
        workflowRun: { id: RUN_ID, status: 'IN_PROGRESS' },
      });
      mockPrisma.workflowTaskRun.update.mockResolvedValueOnce({
        id: TASK_RUN_ID,
        status: 'DONE',
        externalRefType: null,
        externalRefId: null,
      });
      mockPrisma.workflowTaskRun.updateMany.mockResolvedValueOnce({ count: 0 });
      // All tasks are DONE — triggers auto-completion
      mockPrisma.workflowTaskRun.findMany.mockResolvedValueOnce([
        { status: 'DONE', resultJson: null },
        { status: 'DONE', resultJson: null },
      ]);
      mockPrisma.workflowRun.update.mockResolvedValueOnce({});

      await caller.completeTask({ taskRunId: TASK_RUN_ID });

      const runUpdateCall = mockPrisma.workflowRun.update.mock.calls[0]?.[0];
      expect(runUpdateCall.data).toMatchObject({
        status: 'COMPLETED',
        completedAt: expect.any(Date),
      });
    });
  });

  // =========================================================================
  // skipTask — invalid status
  // =========================================================================

  describe('skipTask — invalid status', () => {
    it('throws BAD_REQUEST when task is already DONE', async () => {
      mockPrisma.workflowTaskRun.findFirst.mockResolvedValueOnce({
        id: TASK_RUN_ID,
        organizationId: ORG_ID,
        status: 'DONE',
        workflowRun: { id: RUN_ID, status: 'IN_PROGRESS' },
      });

      await expect(caller.skipTask({ taskRunId: TASK_RUN_ID, reason: 'test' })).rejects.toThrow(
        TRPCError,
      );
    });
  });

  // =========================================================================
  // reassignTask — terminal task
  // =========================================================================

  describe('reassignTask — terminal task', () => {
    it('allows reassigning a TODO task', async () => {
      mockPrisma.workflowTaskRun.findFirst.mockResolvedValueOnce({
        id: TASK_RUN_ID,
        organizationId: ORG_ID,
        status: 'TODO',
      });
      mockPrisma.workflowTaskRun.update.mockResolvedValueOnce({
        id: TASK_RUN_ID,
        title: 'Setup IT Access',
        assigneeUserId: 'new-user-2',
        workflowRun: {
          id: RUN_ID,
          workflowTemplate: { name: 'Onboarding' },
          contractor: { legalName: 'Test Corp', displayName: null },
        },
      });

      const result = await caller.reassignTask({
        taskRunId: TASK_RUN_ID,
        newAssigneeUserId: 'new-user-2',
      });

      expect(result).toMatchObject({ id: TASK_RUN_ID, assigneeUserId: 'new-user-2' });
    });
  });

  // =========================================================================
  // listRuns — search and overdue filter
  // =========================================================================

  describe('listRuns — additional filters', () => {
    it('applies templateId filter', async () => {
      mockPrisma.workflowRun.findMany.mockResolvedValueOnce([]);
      mockPrisma.workflowRun.count.mockResolvedValueOnce(0);

      await caller.listRuns({
        page: 1,
        pageSize: 20,
        filters: { templateId: [TEMPLATE_ID] },
      });

      const findCall = mockPrisma.workflowRun.findMany.mock.calls[0]?.[0];
      expect(findCall.where.workflowTemplateId).toEqual({ in: [TEMPLATE_ID] });
    });

    it('applies search filter via OR clause', async () => {
      mockPrisma.workflowRun.findMany.mockResolvedValueOnce([]);
      mockPrisma.workflowRun.count.mockResolvedValueOnce(0);

      await caller.listRuns({ page: 1, pageSize: 20, search: 'Acme' });

      const findCall = mockPrisma.workflowRun.findMany.mock.calls[0]?.[0];
      expect(findCall.where.OR).toBeDefined();
      expect(findCall.where.OR).toHaveLength(3);
    });

    it('applies overdueOnly filter', async () => {
      mockPrisma.workflowRun.findMany.mockResolvedValueOnce([]);
      mockPrisma.workflowRun.count.mockResolvedValueOnce(0);

      await caller.listRuns({
        page: 1,
        pageSize: 20,
        filters: { overdueOnly: true },
      });

      const findCall = mockPrisma.workflowRun.findMany.mock.calls[0]?.[0];
      expect(findCall.where.tasks).toBeDefined();
      expect(findCall.where.tasks.some.status).toEqual({ in: ['TODO', 'IN_PROGRESS'] });
    });

    it('computes progress for each run in the response', async () => {
      mockPrisma.workflowRun.findMany.mockResolvedValueOnce([
        {
          id: RUN_ID,
          status: 'IN_PROGRESS',
          workflowTemplate: { name: 'Onboarding', type: 'ONBOARDING' },
          contractor: { id: CONTRACTOR_ID, legalName: 'Test', displayName: null },
          tasks: [
            { status: 'DONE', resultJson: null },
            { status: 'TODO', resultJson: null },
          ],
        },
      ]);
      mockPrisma.workflowRun.count.mockResolvedValueOnce(1);

      const result = await caller.listRuns({ page: 1, pageSize: 20 });

      expect(result.items[0]).toHaveProperty('progress');
      expect(result.items[0].progress).toHaveProperty('percent');
    });
  });

  // =========================================================================
  // addComment — with taskRunId
  // =========================================================================

  describe('addComment — with taskRunId', () => {
    it('creates a comment linked to a specific task', async () => {
      mockPrisma.workflowRun.findFirst.mockResolvedValueOnce({
        id: RUN_ID,
        organizationId: ORG_ID,
      });
      mockPrisma.workflowComment.create.mockResolvedValueOnce({
        id: 'comment-2',
        workflowRunId: RUN_ID,
        workflowTaskRunId: TASK_RUN_ID,
        body: 'Task-level comment',
        author: { id: USER_ID, name: 'Test User', image: null },
      });

      const result = await caller.addComment({
        workflowRunId: RUN_ID,
        workflowTaskRunId: TASK_RUN_ID,
        body: 'Task-level comment',
      });

      expect(result).toMatchObject({ id: 'comment-2', workflowTaskRunId: TASK_RUN_ID });

      const createCall = mockPrisma.workflowComment.create.mock.calls[0]?.[0];
      expect(createCall.data.workflowTaskRunId).toBe(TASK_RUN_ID);
    });
  });
});

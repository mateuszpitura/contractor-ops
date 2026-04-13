/**
 * Workflow templates router unit tests.
 *
 * Tests createTemplate, updateTemplate, getTemplate, listTemplates,
 * deleteTemplate, duplicateTemplate, and seedStarterTemplates procedures.
 */

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-wftmpl-001';
const USER_ID = 'user-wftmpl-001';
const TEMPLATE_ID = 'tmpl-001';

// ---------------------------------------------------------------------------
// Mock Prisma via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ dataRegion: 'EU' }),
    },
    workflowTemplate: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    workflowTaskTemplate: {
      createMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    workflowRun: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    workflowTaskRun: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    workflowComment: {
      findMany: vi.fn(),
    },
    contractor: {
      findFirst: vi.fn(),
    },
    member: {
      findFirst: vi.fn().mockResolvedValue({ role: 'admin', userId: USER_ID }),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (fnOrArray: ((tx: Rec) => Promise<unknown>) | unknown[]) => {
      if (typeof fnOrArray === 'function') return fnOrArray(mockPrisma);
      return Promise.all(fnOrArray);
    }),
  };

  return { mockPrisma };
});

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

vi.mock('../../services/cache.js', () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: { dashboardPrefix: (orgId: string) => `dashboard:${orgId}` },
  CacheTTL: {},
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
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init.js';
import { workflowTemplatesRouter } from '../workflow-templates.js';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(workflowTemplatesRouter);

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

describe('workflowTemplatesRouter', () => {
  // =========================================================================
  // createTemplate
  // =========================================================================

  describe('createTemplate', () => {
    it('creates a template with tasks in DRAFT status', async () => {
      mockPrisma.workflowTemplate.create.mockResolvedValueOnce({
        id: TEMPLATE_ID,
        organizationId: ORG_ID,
        name: 'Onboarding',
        status: 'DRAFT',
      });
      mockPrisma.workflowTaskTemplate.createMany.mockResolvedValueOnce({ count: 2 });
      mockPrisma.workflowTemplate.findUniqueOrThrow.mockResolvedValueOnce({
        id: TEMPLATE_ID,
        name: 'Onboarding',
        type: 'ONBOARDING',
        status: 'DRAFT',
        tasks: [
          { id: 'task-1', title: 'Collect NDA', sortOrder: 0 },
          { id: 'task-2', title: 'Sign Contract', sortOrder: 1 },
        ],
      });

      const result = await caller.createTemplate({
        name: 'Onboarding',
        type: 'ONBOARDING',
        tasks: [
          {
            title: 'Collect NDA',
            taskType: 'DOCUMENT_COLLECTION',
            sortOrder: 0,
            required: true,
            assigneeMode: 'ROLE_BASED',
          },
          {
            title: 'Sign Contract',
            taskType: 'APPROVAL',
            sortOrder: 1,
            required: true,
            assigneeMode: 'ROLE_BASED',
          },
        ],
      });

      expect(result).toMatchObject({ id: TEMPLATE_ID, name: 'Onboarding', status: 'DRAFT' });

      const createCall = mockPrisma.workflowTemplate.create.mock.calls[0]?.[0];
      expect(createCall.data).toMatchObject({
        organizationId: ORG_ID,
        name: 'Onboarding',
        type: 'ONBOARDING',
        version: 1,
        status: 'DRAFT',
        createdByUserId: USER_ID,
      });
    });

    it('creates template with empty tasks array', async () => {
      mockPrisma.workflowTemplate.create.mockResolvedValueOnce({
        id: TEMPLATE_ID,
        organizationId: ORG_ID,
        name: 'Empty',
        status: 'DRAFT',
      });
      mockPrisma.workflowTemplate.findUniqueOrThrow.mockResolvedValueOnce({
        id: TEMPLATE_ID,
        name: 'Empty',
        status: 'DRAFT',
        tasks: [],
      });

      const result = await caller.createTemplate({
        name: 'Empty',
        type: 'ONBOARDING',
        tasks: [],
      });

      expect(result).toMatchObject({ id: TEMPLATE_ID });
      expect(mockPrisma.workflowTaskTemplate.createMany).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // updateTemplate
  // =========================================================================

  describe('updateTemplate', () => {
    it('updates template fields and replaces tasks', async () => {
      mockPrisma.workflowTemplate.findFirst.mockResolvedValueOnce({
        id: TEMPLATE_ID,
        organizationId: ORG_ID,
        name: 'Old Name',
        status: 'DRAFT',
      });
      mockPrisma.workflowTemplate.update.mockResolvedValueOnce({});
      mockPrisma.workflowTaskTemplate.deleteMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.workflowTaskTemplate.createMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.workflowTemplate.findUniqueOrThrow.mockResolvedValueOnce({
        id: TEMPLATE_ID,
        name: 'New Name',
        status: 'ACTIVE',
        tasks: [{ id: 'task-new', title: 'Updated Task' }],
      });

      const result = await caller.updateTemplate({
        id: TEMPLATE_ID,
        name: 'New Name',
        status: 'ACTIVE',
        tasks: [
          {
            title: 'Updated Task',
            taskType: 'APPROVAL',
            sortOrder: 0,
            required: true,
            assigneeMode: 'FIXED_USER',
          },
        ],
      });

      expect(result).toMatchObject({ name: 'New Name', status: 'ACTIVE' });

      // Tasks should be deleted and recreated
      expect(mockPrisma.workflowTaskTemplate.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workflowTemplateId: TEMPLATE_ID } }),
      );
      expect(mockPrisma.workflowTaskTemplate.createMany).toHaveBeenCalled();
    });

    it('throws NOT_FOUND when template does not exist', async () => {
      mockPrisma.workflowTemplate.findFirst.mockResolvedValueOnce(null);

      await expect(caller.updateTemplate({ id: 'nonexistent', name: 'Fail' })).rejects.toThrow(
        TRPCError,
      );
    });
  });

  // =========================================================================
  // getTemplate
  // =========================================================================

  describe('getTemplate', () => {
    it('returns template with tasks ordered by sortOrder', async () => {
      mockPrisma.workflowTemplate.findFirst.mockResolvedValueOnce({
        id: TEMPLATE_ID,
        organizationId: ORG_ID,
        name: 'Onboarding',
        tasks: [{ id: 'task-1', sortOrder: 0 }],
      });

      const result = await caller.getTemplate({ id: TEMPLATE_ID });

      expect(result).toMatchObject({ id: TEMPLATE_ID, name: 'Onboarding' });

      const call = mockPrisma.workflowTemplate.findFirst.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({ id: TEMPLATE_ID, organizationId: ORG_ID });
      expect(call.include.tasks).toBeDefined();
    });

    it('throws NOT_FOUND when template does not exist', async () => {
      mockPrisma.workflowTemplate.findFirst.mockResolvedValueOnce(null);

      await expect(caller.getTemplate({ id: 'nonexistent' })).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // listTemplates
  // =========================================================================

  describe('listTemplates', () => {
    it('queries with organization scope and pagination', async () => {
      mockPrisma.workflowTemplate.findMany.mockResolvedValueOnce([]);
      mockPrisma.workflowTemplate.count.mockResolvedValueOnce(0);

      const result = await caller.listTemplates({ page: 1, pageSize: 20 });

      expect(result).toMatchObject({ items: [], total: 0, page: 1, pageSize: 20 });

      const findCall = mockPrisma.workflowTemplate.findMany.mock.calls[0]?.[0];
      expect(findCall.where).toMatchObject({ organizationId: ORG_ID });
    });

    it('applies status filter', async () => {
      mockPrisma.workflowTemplate.findMany.mockResolvedValueOnce([]);
      mockPrisma.workflowTemplate.count.mockResolvedValueOnce(0);

      await caller.listTemplates({ page: 1, pageSize: 20, status: ['ACTIVE'] });

      const findCall = mockPrisma.workflowTemplate.findMany.mock.calls[0]?.[0];
      expect(findCall.where.status).toEqual({ in: ['ACTIVE'] });
    });

    it('applies search filter on name', async () => {
      mockPrisma.workflowTemplate.findMany.mockResolvedValueOnce([]);
      mockPrisma.workflowTemplate.count.mockResolvedValueOnce(0);

      await caller.listTemplates({ page: 1, pageSize: 20, search: 'onboard' });

      const findCall = mockPrisma.workflowTemplate.findMany.mock.calls[0]?.[0];
      expect(findCall.where.name).toMatchObject({
        contains: 'onboard',
        mode: 'insensitive',
      });
    });
  });

  // =========================================================================
  // deleteTemplate
  // =========================================================================

  describe('deleteTemplate', () => {
    it('deletes a DRAFT template with no runs', async () => {
      mockPrisma.workflowTemplate.findFirst.mockResolvedValueOnce({
        id: TEMPLATE_ID,
        organizationId: ORG_ID,
        status: 'DRAFT',
        _count: { runs: 0 },
      });
      mockPrisma.workflowTaskTemplate.deleteMany.mockResolvedValueOnce({ count: 3 });
      mockPrisma.workflowTemplate.delete.mockResolvedValueOnce({});

      const result = await caller.deleteTemplate({ id: TEMPLATE_ID });

      expect(result).toEqual({ success: true });
    });

    it('throws NOT_FOUND when template does not exist', async () => {
      mockPrisma.workflowTemplate.findFirst.mockResolvedValueOnce(null);

      await expect(caller.deleteTemplate({ id: 'nonexistent' })).rejects.toThrow(TRPCError);
    });

    it('throws BAD_REQUEST when template is not DRAFT', async () => {
      mockPrisma.workflowTemplate.findFirst.mockResolvedValueOnce({
        id: TEMPLATE_ID,
        organizationId: ORG_ID,
        status: 'ACTIVE',
        _count: { runs: 0 },
      });

      await expect(caller.deleteTemplate({ id: TEMPLATE_ID })).rejects.toThrow(TRPCError);
    });

    it('throws BAD_REQUEST when template has existing runs', async () => {
      mockPrisma.workflowTemplate.findFirst.mockResolvedValueOnce({
        id: TEMPLATE_ID,
        organizationId: ORG_ID,
        status: 'DRAFT',
        _count: { runs: 5 },
      });

      await expect(caller.deleteTemplate({ id: TEMPLATE_ID })).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // duplicateTemplate
  // =========================================================================

  describe('duplicateTemplate', () => {
    it('creates a DRAFT copy with (copy) suffix', async () => {
      mockPrisma.workflowTemplate.findFirst.mockResolvedValueOnce({
        id: TEMPLATE_ID,
        organizationId: ORG_ID,
        name: 'Onboarding',
        type: 'ONBOARDING',
        description: 'Standard workflow',
        appliesToEntityType: 'CONTRACTOR',
        tasks: [
          {
            id: 'task-src-1',
            title: 'Task 1',
            description: null,
            taskType: 'APPROVAL',
            sortOrder: 0,
            required: true,
            assigneeMode: 'ROLE_BASED',
            assigneeRole: 'OPS_MANAGER',
            assigneeUserId: null,
            dueOffsetDays: 5,
            dueOffsetHours: null,
            dependsOnTaskTemplateId: null,
            externalUrl: null,
            configJson: null,
          },
        ],
      });
      mockPrisma.workflowTemplate.create.mockResolvedValueOnce({
        id: 'tmpl-dup-001',
        name: 'Onboarding (copy)',
        status: 'DRAFT',
      });
      mockPrisma.workflowTaskTemplate.create.mockResolvedValueOnce({
        id: 'task-dup-1',
      });
      mockPrisma.workflowTemplate.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'tmpl-dup-001',
        name: 'Onboarding (copy)',
        status: 'DRAFT',
        tasks: [{ id: 'task-dup-1', title: 'Task 1' }],
      });

      const result = await caller.duplicateTemplate({ id: TEMPLATE_ID });

      expect(result).toMatchObject({
        id: 'tmpl-dup-001',
        name: 'Onboarding (copy)',
        status: 'DRAFT',
      });

      const createCall = mockPrisma.workflowTemplate.create.mock.calls[0]?.[0];
      expect(createCall.data.name).toBe('Onboarding (copy)');
      expect(createCall.data.status).toBe('DRAFT');
      expect(createCall.data.version).toBe(1);
    });

    it('throws NOT_FOUND when source template does not exist', async () => {
      mockPrisma.workflowTemplate.findFirst.mockResolvedValueOnce(null);

      await expect(caller.duplicateTemplate({ id: 'nonexistent' })).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // seedStarterTemplates
  // =========================================================================

  describe('seedStarterTemplates', () => {
    it('seeds onboarding and offboarding templates when none exist', async () => {
      mockPrisma.workflowTemplate.count.mockResolvedValueOnce(0);
      mockPrisma.workflowTemplate.create
        .mockResolvedValueOnce({ id: 'tmpl-onb', name: 'Contractor Onboarding' })
        .mockResolvedValueOnce({ id: 'tmpl-off', name: 'Contractor Offboarding' });
      mockPrisma.workflowTaskTemplate.createMany
        .mockResolvedValueOnce({ count: 7 })
        .mockResolvedValueOnce({ count: 5 });

      const result = await caller.seedStarterTemplates();

      expect(result).toEqual({ seeded: true });
      expect(mockPrisma.workflowTemplate.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.workflowTaskTemplate.createMany).toHaveBeenCalledTimes(2);
    });

    it('returns seeded: false when templates already exist', async () => {
      mockPrisma.workflowTemplate.count.mockResolvedValueOnce(3);

      const result = await caller.seedStarterTemplates();

      expect(result).toEqual({ seeded: false });
      expect(mockPrisma.workflowTemplate.create).not.toHaveBeenCalled();
    });
  });
});

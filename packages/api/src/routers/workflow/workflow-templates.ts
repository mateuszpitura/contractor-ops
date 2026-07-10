/**
 * Workflow template procedures: CRUD, duplication, and starter template seeding.
 */

import { memberRoleToUserRole } from '@contractor-ops/auth/role-normalization';
import type { Prisma } from '@contractor-ops/db';
import type { TemplateCreateInput } from '@contractor-ops/validators';
import {
  entityIdSchema,
  templateCreateSchema,
  templateListSchema,
  templateUpdateSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import type { TenantDbTx } from '../../lib/tenant-db';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { WORKFLOW_TEMPLATE_KEYS } from './workflow-shared';

type TaskTemplateInput = TemplateCreateInput['tasks'][number] & { id?: string };

function taskDependencyKey(task: TaskTemplateInput, index: number): string {
  return task.id ?? `task-${index}`;
}

/** Idempotent patch: add IP_VERIFICATION to existing OFFBOARDING templates that lack it. */
async function ensureOffboardingIpVerificationTasks(
  tx: TenantDbTx,
  organizationId: string,
): Promise<number> {
  const templates = await tx.workflowTemplate.findMany({
    where: { organizationId, type: 'OFFBOARDING' },
    include: {
      tasks: { where: { taskType: 'IP_VERIFICATION' }, select: { id: true } },
    },
  });

  let patched = 0;
  for (const template of templates) {
    if (template.tasks.length > 0) continue;
    await tx.workflowTaskTemplate.create({
      data: {
        organizationId,
        workflowTemplateId: template.id,
        title: WORKFLOW_TEMPLATE_KEYS.offboarding.ipVerification,
        taskType: 'IP_VERIFICATION',
        assigneeMode: 'ROLE_BASED',
        assigneeRole: 'ADMIN',
        dueOffsetDays: 7,
        sortOrder: 4,
        required: true,
        description: null,
        assigneeUserId: null,
        dueOffsetHours: null,
        dependsOnTaskTemplateId: null,
        externalUrl: null,
      },
    });
    patched += 1;
  }
  return patched;
}

function assertNoDependencyCycles(
  tasks: TaskTemplateInput[],
  keyToIndex: Map<string, number>,
): void {
  const visiting = new Set<number>();
  const visited = new Set<number>();

  const visit = (index: number): void => {
    if (visited.has(index)) return;
    if (visiting.has(index)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: E.WORKFLOW_TEMPLATE_DEPENDENCY_CYCLE,
      });
    }
    visiting.add(index);
    const depKey = tasks[index]?.dependsOnTaskTemplateId;
    if (depKey) {
      const depIndex = keyToIndex.get(depKey);
      if (depIndex !== undefined) {
        visit(depIndex);
      }
    }
    visiting.delete(index);
    visited.add(index);
  };

  for (let i = 0; i < tasks.length; i++) {
    visit(i);
  }
}

/**
 * Creates task templates in two passes so intra-template dependency ids are
 * remapped to freshly created row ids (not stale placeholders from the UI).
 */
async function createTasksWithDependencyRemap(
  tx: TenantDbTx,
  organizationId: string,
  workflowTemplateId: string,
  tasks: TaskTemplateInput[],
): Promise<void> {
  if (tasks.length === 0) return;

  const keyToIndex = new Map(tasks.map((task, index) => [taskDependencyKey(task, index), index]));

  for (const task of tasks) {
    const depKey = task.dependsOnTaskTemplateId;
    if (depKey && !keyToIndex.has(depKey)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: E.WORKFLOW_TEMPLATE_UNKNOWN_DEPENDENCY,
      });
    }
  }

  assertNoDependencyCycles(tasks, keyToIndex);

  const oldKeyToNewId = new Map<string, string>();

  for (const [index, task] of tasks.entries()) {
    const created = await tx.workflowTaskTemplate.create({
      data: {
        organizationId,
        workflowTemplateId,
        title: task.title,
        description: task.description ?? null,
        taskType: task.taskType,
        sortOrder: task.sortOrder,
        required: task.required,
        assigneeMode: task.assigneeMode,
        assigneeRole: memberRoleToUserRole(task.assigneeRole),
        assigneeUserId: task.assigneeUserId ?? null,
        dueOffsetDays: task.dueOffsetDays ?? null,
        dueOffsetHours: task.dueOffsetHours ?? null,
        dependsOnTaskTemplateId: null,
        externalUrl: task.externalUrl || null,
        configJson: task.conditions ?? undefined,
      },
    });
    oldKeyToNewId.set(taskDependencyKey(task, index), created.id);
  }

  for (const [index, task] of tasks.entries()) {
    const depKey = task.dependsOnTaskTemplateId;
    if (!depKey) continue;
    const newId = oldKeyToNewId.get(taskDependencyKey(task, index));
    const newDepId = oldKeyToNewId.get(depKey);
    if (newId && newDepId) {
      await tx.workflowTaskTemplate.update({
        where: { id: newId },
        data: { dependsOnTaskTemplateId: newDepId },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SourceTaskTemplate = Prisma.WorkflowTaskTemplateGetPayload<true>;

/**
 * Deep-clone a template's tasks into `newTemplateId` inside the caller's
 * transaction: first create every task (recording an old→new id map), then
 * remap `dependsOnTaskTemplateId` so intra-template dependencies point at the
 * new rows. The two passes share the id map and must run in this order.
 */
async function cloneTemplateTasks(
  tx: TenantDbTx,
  organizationId: string,
  newTemplateId: string,
  sourceTasks: readonly SourceTaskTemplate[],
): Promise<void> {
  if (sourceTasks.length === 0) return;

  const oldToNewId = new Map<string, string>();

  for (const task of sourceTasks) {
    const newTask = await tx.workflowTaskTemplate.create({
      data: {
        organizationId,
        workflowTemplateId: newTemplateId,
        title: task.title,
        description: task.description,
        taskType: task.taskType,
        sortOrder: task.sortOrder,
        required: task.required,
        assigneeMode: task.assigneeMode,
        assigneeRole: task.assigneeRole,
        assigneeUserId: task.assigneeUserId,
        dueOffsetDays: task.dueOffsetDays,
        dueOffsetHours: task.dueOffsetHours,
        dependsOnTaskTemplateId: null, // remapped below
        externalUrl: task.externalUrl,
        configJson: task.configJson ?? undefined,
      },
    });
    oldToNewId.set(task.id, newTask.id);
  }

  // Remap dependencies to new IDs.
  for (const task of sourceTasks) {
    if (task.dependsOnTaskTemplateId) {
      const newId = oldToNewId.get(task.id);
      const newDepId = oldToNewId.get(task.dependsOnTaskTemplateId);
      if (newId && newDepId) {
        await tx.workflowTaskTemplate.update({
          where: { id: newId },
          data: { dependsOnTaskTemplateId: newDepId },
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Workflow Templates sub-router
// ---------------------------------------------------------------------------

export const workflowTemplatesRouter = router({
  /**
   * Create a new workflow template with task definitions.
   */
  createTemplate: tenantProcedure
    .use(requirePermission({ workflow: ['create'] }))
    .input(templateCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.$transaction(async tx => {
        const created = await tx.workflowTemplate.create({
          data: {
            organizationId: ctx.organizationId,
            name: input.name,
            type: input.type,
            description: input.description ?? null,
            version: 1,
            status: 'DRAFT',
            appliesToEntityType: 'CONTRACTOR',
            createdByUserId: ctx.user.id,
          },
        });

        if (input.tasks.length > 0) {
          await createTasksWithDependencyRemap(tx, ctx.organizationId, created.id, input.tasks);
        }

        return tx.workflowTemplate.findUniqueOrThrow({
          where: { id: created.id },
          include: { tasks: { orderBy: { sortOrder: 'asc' } } },
        });
      });

      return template;
    }),

  /**
   * Update a workflow template. Tasks are replaced (delete all + recreate).
   */
  updateTemplate: tenantProcedure
    .use(requirePermission({ workflow: ['update'] }))
    .input(templateUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.$transaction(async tx => {
        const existing = await tx.workflowTemplate.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
          },
        });

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.WORKFLOW_TEMPLATE_NOT_FOUND,
          });
        }

        // Update template fields
        const updateData: Prisma.WorkflowTemplateUpdateInput = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.type !== undefined) updateData.type = input.type;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.status !== undefined) updateData.status = input.status;

        await tx.workflowTemplate.update({
          where: { id: input.id },
          data: updateData,
        });

        // Replace tasks if provided (delete all + recreate for clean reorder)
        if (input.tasks !== undefined) {
          await tx.workflowTaskTemplate.deleteMany({
            where: { workflowTemplateId: input.id },
          });

          if (input.tasks.length > 0) {
            await createTasksWithDependencyRemap(tx, ctx.organizationId, input.id, input.tasks);
          }
        }

        return tx.workflowTemplate.findUniqueOrThrow({
          where: { id: input.id },
          include: { tasks: { orderBy: { sortOrder: 'asc' } } },
        });
      });

      return template;
    }),

  /**
   * Get a workflow template by ID with tasks.
   */
  getTemplate: tenantProcedure
    .use(requirePermission({ workflow: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.workflowTemplate.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: { tasks: { orderBy: { sortOrder: 'asc' } } },
      });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.WORKFLOW_TEMPLATE_NOT_FOUND,
        });
      }

      return template;
    }),

  /**
   * List workflow templates with pagination, search, and status filter.
   */
  listTemplates: tenantProcedure
    .use(requirePermission({ workflow: ['read'] }))
    .input(templateListSchema)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, status } = input;

      const where: Prisma.WorkflowTemplateWhereInput = {
        organizationId: ctx.organizationId,
      };

      if (status?.length) {
        where.status = { in: status };
      }

      if (search && search.length >= 2) {
        where.name = { contains: search, mode: 'insensitive' };
      }

      const [items, total] = await Promise.all([
        ctx.db.workflowTemplate.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: { select: { runs: true, tasks: true } },
          },
        }),
        ctx.db.workflowTemplate.count({ where }),
      ]);

      return { items, total, page, pageSize };
    }),

  /**
   * Delete a workflow template (only DRAFT with no runs).
   */
  deleteTemplate: tenantProcedure
    .use(requirePermission({ workflow: ['delete'] }))
    .input(entityIdSchema)
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.workflowTemplate.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: { _count: { select: { runs: true } } },
      });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.WORKFLOW_TEMPLATE_NOT_FOUND,
        });
      }

      if (template.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.WORKFLOW_TEMPLATE_ONLY_DRAFT_DELETE,
        });
      }

      if (template._count.runs > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.WORKFLOW_TEMPLATE_HAS_RUNS,
        });
      }

      await ctx.db.$transaction(async tx => {
        await tx.workflowTaskTemplate.deleteMany({
          where: { workflowTemplateId: input.id },
        });
        await tx.workflowTemplate.delete({
          where: { id: input.id },
        });
      });

      return { success: true };
    }),

  /**
   * Duplicate a workflow template (creates a new DRAFT copy).
   */
  duplicateTemplate: tenantProcedure
    .use(requirePermission({ workflow: ['create'] }))
    .input(entityIdSchema)
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.db.workflowTemplate.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: { tasks: { orderBy: { sortOrder: 'asc' } } },
      });

      if (!source) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.WORKFLOW_TEMPLATE_NOT_FOUND,
        });
      }

      const duplicate = await ctx.db.$transaction(async tx => {
        const created = await tx.workflowTemplate.create({
          data: {
            organizationId: ctx.organizationId,
            name: `${source.name} (copy)`,
            type: source.type,
            description: source.description,
            version: 1,
            status: 'DRAFT',
            appliesToEntityType: source.appliesToEntityType,
            createdByUserId: ctx.user.id,
          },
        });

        await cloneTemplateTasks(tx, ctx.organizationId, created.id, source.tasks);

        return tx.workflowTemplate.findUniqueOrThrow({
          where: { id: created.id },
          include: { tasks: { orderBy: { sortOrder: 'asc' } } },
        });
      });

      return duplicate;
    }),

  /**
   * Seed starter templates (Onboarding + Offboarding) for the org.
   * No-op if any templates already exist. Called from Templates tab on first visit.
   */
  seedStarterTemplates: tenantProcedure
    .use(requirePermission({ workflow: ['create'] }))
    .mutation(async ({ ctx }) => {
      const existingCount = await ctx.db.workflowTemplate.count({
        where: { organizationId: ctx.organizationId },
      });

      if (existingCount > 0) {
        const patchedOffboardingIpTasks = await ctx.db.$transaction(tx =>
          ensureOffboardingIpVerificationTasks(tx, ctx.organizationId),
        );
        return { seeded: false, patchedOffboardingIpTasks };
      }

      await ctx.db.$transaction(async tx => {
        // ----- Template 1: Contractor Onboarding -----
        const onboarding = await tx.workflowTemplate.create({
          data: {
            organizationId: ctx.organizationId,
            name: 'Contractor Onboarding',
            type: 'ONBOARDING',
            description:
              'Standard onboarding workflow for new contractors. Review and customize tasks before activating.',
            version: 1,
            status: 'DRAFT',
            appliesToEntityType: 'CONTRACTOR',
            createdByUserId: ctx.user.id,
          },
        });

        const onboardingTasks = [
          {
            title: WORKFLOW_TEMPLATE_KEYS.onboarding.collectNda,
            taskType: 'DOCUMENT_COLLECTION' as const,
            assigneeRole: 'OPS_MANAGER' as const,
            dueOffsetDays: 2,
            sortOrder: 0,
          },
          {
            title: WORKFLOW_TEMPLATE_KEYS.onboarding.signContract,
            taskType: 'APPROVAL' as const,
            assigneeRole: 'LEGAL_COMPLIANCE_VIEWER' as const,
            dueOffsetDays: 5,
            sortOrder: 1,
          },
          {
            title: WORKFLOW_TEMPLATE_KEYS.onboarding.setupItAccess,
            taskType: 'ACCESS_GRANT' as const,
            assigneeRole: 'IT_ADMIN' as const,
            dueOffsetDays: 3,
            sortOrder: 2,
          },
          {
            title: WORKFLOW_TEMPLATE_KEYS.onboarding.setupFinance,
            taskType: 'FINANCE_SETUP' as const,
            assigneeRole: 'FINANCE_ADMIN' as const,
            dueOffsetDays: 3,
            sortOrder: 3,
          },
          {
            title: WORKFLOW_TEMPLATE_KEYS.onboarding.provisionEquipment,
            taskType: 'EQUIPMENT' as const,
            assigneeRole: 'OPS_MANAGER' as const,
            dueOffsetDays: 5,
            sortOrder: 4,
          },
          {
            title: WORKFLOW_TEMPLATE_KEYS.onboarding.teamIntroMeeting,
            taskType: 'MEETING' as const,
            assigneeRole: 'TEAM_MANAGER' as const,
            dueOffsetDays: 7,
            sortOrder: 5,
          },
          {
            title: WORKFLOW_TEMPLATE_KEYS.onboarding.knowledgeTransfer,
            taskType: 'KNOWLEDGE_TRANSFER' as const,
            assigneeRole: 'TEAM_MANAGER' as const,
            dueOffsetDays: 14,
            sortOrder: 6,
          },
        ];

        await tx.workflowTaskTemplate.createMany({
          data: onboardingTasks.map(task => ({
            organizationId: ctx.organizationId,
            workflowTemplateId: onboarding.id,
            title: task.title,
            taskType: task.taskType,
            assigneeMode: 'ROLE_BASED' as const,
            assigneeRole: task.assigneeRole,
            dueOffsetDays: task.dueOffsetDays,
            sortOrder: task.sortOrder,
            required: true,
            description: null,
            assigneeUserId: null,
            dueOffsetHours: null,
            dependsOnTaskTemplateId: null,
            externalUrl: null,
          })),
        });

        // ----- Template 2: Contractor Offboarding -----
        const offboarding = await tx.workflowTemplate.create({
          data: {
            organizationId: ctx.organizationId,
            name: 'Contractor Offboarding',
            type: 'OFFBOARDING',
            description:
              'Standard offboarding workflow for departing contractors. Review and customize tasks before activating.',
            version: 1,
            status: 'DRAFT',
            appliesToEntityType: 'CONTRACTOR',
            createdByUserId: ctx.user.id,
          },
        });

        const offboardingTasks = [
          {
            title: WORKFLOW_TEMPLATE_KEYS.offboarding.knowledgeTransfer,
            taskType: 'KNOWLEDGE_TRANSFER' as const,
            assigneeRole: 'TEAM_MANAGER' as const,
            dueOffsetDays: 7,
            sortOrder: 0,
          },
          {
            title: WORKFLOW_TEMPLATE_KEYS.offboarding.revokeItAccess,
            taskType: 'ACCESS_REVOKE' as const,
            assigneeRole: 'IT_ADMIN' as const,
            dueOffsetDays: 1,
            sortOrder: 1,
          },
          {
            title: WORKFLOW_TEMPLATE_KEYS.offboarding.returnEquipment,
            taskType: 'EQUIPMENT' as const,
            assigneeRole: 'OPS_MANAGER' as const,
            dueOffsetDays: 5,
            sortOrder: 2,
          },
          {
            title: WORKFLOW_TEMPLATE_KEYS.offboarding.financeWrapUp,
            taskType: 'FINANCE_SETUP' as const,
            assigneeRole: 'FINANCE_ADMIN' as const,
            dueOffsetDays: 3,
            sortOrder: 3,
          },
          {
            title: WORKFLOW_TEMPLATE_KEYS.offboarding.ipVerification,
            taskType: 'IP_VERIFICATION' as const,
            assigneeRole: 'ADMIN' as const,
            dueOffsetDays: 7,
            sortOrder: 4,
          },
          {
            title: WORKFLOW_TEMPLATE_KEYS.offboarding.finalDocumentation,
            taskType: 'DOCUMENT_COLLECTION' as const,
            assigneeRole: 'OPS_MANAGER' as const,
            dueOffsetDays: 5,
            sortOrder: 5,
          },
        ];

        await tx.workflowTaskTemplate.createMany({
          data: offboardingTasks.map(task => ({
            organizationId: ctx.organizationId,
            workflowTemplateId: offboarding.id,
            title: task.title,
            taskType: task.taskType,
            assigneeMode: 'ROLE_BASED' as const,
            assigneeRole: task.assigneeRole,
            dueOffsetDays: task.dueOffsetDays,
            sortOrder: task.sortOrder,
            required: true,
            description: null,
            assigneeUserId: null,
            dueOffsetHours: null,
            dependsOnTaskTemplateId: null,
            externalUrl: null,
          })),
        });
      });

      return { seeded: true };
    }),
});

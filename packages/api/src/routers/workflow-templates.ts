/**
 * Workflow template procedures: CRUD, duplication, and starter template seeding.
 */
import type { Prisma } from '@contractor-ops/db';
import {
  templateCreateSchema,
  templateListSchema,
  templateUpdateSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../errors.js';
import { router } from '../init.js';
import { requirePermission } from '../middleware/rbac.js';
import { tenantProcedure } from '../middleware/tenant.js';
import { plain, WORKFLOW_TEMPLATE_KEYS } from './workflow-shared.js';

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
          await tx.workflowTaskTemplate.createMany({
            data: input.tasks.map(task => ({
              organizationId: ctx.organizationId,
              workflowTemplateId: created.id,
              title: task.title,
              description: task.description ?? null,
              taskType: task.taskType,
              sortOrder: task.sortOrder,
              required: task.required,
              assigneeMode: task.assigneeMode,
              assigneeRole: task.assigneeRole ?? null,
              assigneeUserId: task.assigneeUserId ?? null,
              dueOffsetDays: task.dueOffsetDays ?? null,
              dueOffsetHours: task.dueOffsetHours ?? null,
              dependsOnTaskTemplateId: task.dependsOnTaskTemplateId ?? null,
              externalUrl: task.externalUrl || null,
              configJson: task.conditions ?? undefined,
            })),
          });
        }

        return tx.workflowTemplate.findUniqueOrThrow({
          where: { id: created.id },
          include: { tasks: { orderBy: { sortOrder: 'asc' } } },
        });
      });

      return plain(template);
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
            await tx.workflowTaskTemplate.createMany({
              data: input.tasks.map(task => ({
                organizationId: ctx.organizationId,
                workflowTemplateId: input.id,
                title: task.title,
                description: task.description ?? null,
                taskType: task.taskType,
                sortOrder: task.sortOrder,
                required: task.required,
                assigneeMode: task.assigneeMode,
                assigneeRole: task.assigneeRole ?? null,
                assigneeUserId: task.assigneeUserId ?? null,
                dueOffsetDays: task.dueOffsetDays ?? null,
                dueOffsetHours: task.dueOffsetHours ?? null,
                dependsOnTaskTemplateId: task.dependsOnTaskTemplateId ?? null,
                externalUrl: task.externalUrl || null,
                configJson: task.conditions ?? undefined,
              })),
            });
          }
        }

        return tx.workflowTemplate.findUniqueOrThrow({
          where: { id: input.id },
          include: { tasks: { orderBy: { sortOrder: 'asc' } } },
        });
      });

      return plain(template);
    }),

  /**
   * Get a workflow template by ID with tasks.
   */
  getTemplate: tenantProcedure
    .use(requirePermission({ workflow: ['read'] }))
    .input(z.object({ id: z.string() }))
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

      return plain(template);
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

      return plain({ items, total, page, pageSize });
    }),

  /**
   * Delete a workflow template (only DRAFT with no runs).
   */
  deleteTemplate: tenantProcedure
    .use(requirePermission({ workflow: ['delete'] }))
    .input(z.object({ id: z.string() }))
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
          message: 'Only draft templates can be deleted. Archive the template instead.',
        });
      }

      if (template._count.runs > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete a template that has existing runs. Archive it instead.',
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
    .input(z.object({ id: z.string() }))
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

        if (source.tasks.length > 0) {
          // Build old-id -> new-id map for dependency remapping
          const oldToNewId = new Map<string, string>();

          for (const task of source.tasks) {
            const newTask = await tx.workflowTaskTemplate.create({
              data: {
                organizationId: ctx.organizationId,
                workflowTemplateId: created.id,
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

          // Remap dependencies to new IDs
          for (const task of source.tasks) {
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

        return tx.workflowTemplate.findUniqueOrThrow({
          where: { id: created.id },
          include: { tasks: { orderBy: { sortOrder: 'asc' } } },
        });
      });

      return plain(duplicate);
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
        return { seeded: false };
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
            assigneeRole: 'LEGAL_VIEWER' as const,
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
            title: WORKFLOW_TEMPLATE_KEYS.offboarding.finalDocumentation,
            taskType: 'DOCUMENT_COLLECTION' as const,
            assigneeRole: 'OPS_MANAGER' as const,
            dueOffsetDays: 5,
            sortOrder: 4,
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

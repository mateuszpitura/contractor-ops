/**
 * Workflow run lifecycle procedures.
 */

import {
  cancelRunSchema,
  entityIdSchema,
  startRunSchema,
  workflowRunListSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { CacheKeys, invalidateByPrefix } from '../../services/cache';
import { handleEquipmentTaskStart } from '../../services/equipment-workflow';
import { dispatch } from '../../services/notification-service';
import { calculateProgress } from './workflow-shared';
import {
  buildIntegrationEligibility,
  computeMaxDueDate,
  instantiateTaskRuns,
  syncCalendarTasksAfterStart,
  syncJiraTasksAfterStart,
  syncLinearTasksAfterStart,
  syncTaskToExternalSystems,
} from './workflow-execution-shared';

export const workflowExecutionRunsRouter = router({


  /**
   * Start a workflow run from a template for a specific contractor.
   * Instantiates all task runs, evaluates conditions, resolves assignees.
   */
  startRun: tenantProcedure
    .use(requirePermission({ workflow: ['execute'] }))
    .input(startRunSchema)
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.$transaction(async tx => {
        const template = await findOrThrow(
          () =>
            tx.workflowTemplate.findFirst({
              where: {
                id: input.templateId,
                organizationId: ctx.organizationId,
                status: 'ACTIVE',
              },
              include: { tasks: { orderBy: { sortOrder: 'asc' } } },
            }),
          E.WORKFLOW_TEMPLATE_NOT_FOUND,
        );

        const contractor = await findOrThrow(
          () =>
            tx.contractor.findFirst({
              where: {
                id: input.contractorId,
                organizationId: ctx.organizationId,
                deletedAt: null,
              },
            }),
          E.CONTRACTOR_NOT_FOUND,
        );

        const contract = input.contractId
          ? await tx.contract.findFirst({
              where: {
                id: input.contractId,
                organizationId: ctx.organizationId,
                deletedAt: null,
              },
            })
          : null;

        const now = new Date();

        // Compute a global dueAt from the maximum task offset
        const maxDueDate = computeMaxDueDate(template.tasks, now);

        const workflowRun = await tx.workflowRun.create({
          data: {
            organizationId: ctx.organizationId,
            workflowTemplateId: template.id,
            entityType: 'CONTRACTOR',
            entityId: contractor.id,
            contractorId: contractor.id,
            contractId: contract?.id ?? null,
            status: 'IN_PROGRESS',
            startedByUserId: ctx.user.id,
            startedAt: now,
            dueAt: maxDueDate,
          },
        });

        // Instantiate all task runs from template tasks
        const taskIdMap = await instantiateTaskRuns(
          tx,
          ctx.organizationId,
          workflowRun.id,
          template.tasks,
          contractor,
          contract,
          now,
        );

        // Compute initial progress
        const allTasks = await tx.workflowTaskRun.findMany({
          where: { workflowRunId: workflowRun.id },
        });
        const progress = calculateProgress(allTasks);

        // F-DB-18 — collapse the previous `update + findUniqueOrThrow` pair
        // into a single `update({ include })` call so we save one round-trip
        // (and one row lookup) inside the transaction. Prisma returns the
        // full updated row with the requested relations.
        const fullRun = await tx.workflowRun.update({
          where: { id: workflowRun.id },
          data: { progressPercent: progress.percent },
          include: {
            tasks: { orderBy: { createdAt: 'asc' } },
            workflowTemplate: { select: { name: true, type: true } },
          },
        });

        // Build integration eligibility maps for all task templates
        const {
          jiraEligibleTaskRunIds,
          linearEligibleTaskRuns,
          calendarConfigMap,
          equipmentEligibleTaskRunIds,
        } = buildIntegrationEligibility(template.tasks, taskIdMap);

        return {
          run: fullRun,
          contractorName: contractor.legalName ?? contractor.displayName ?? 'Unknown',
          jiraEligibleTaskRunIds,
          linearEligibleTaskRuns,
          calendarConfigMap,
          calendarTaskCount: calendarConfigMap.size,
          contractName: contract?.title ?? '',
          equipmentEligibleTaskRunIds,
          templateType: template.type,
        };
      });

      // Fire-and-forget: dispatch TASK_ASSIGNED to each task assignee
      const activeTasks = run.run.tasks.filter(t => t.status !== 'SKIPPED' && t.assigneeUserId);
      for (const task of activeTasks) {
        dispatch({
          organizationId: ctx.organizationId,
          type: 'TASK_ASSIGNED',
          recipientUserIds: [task.assigneeUserId as string],
          title: `Task assigned: ${task.title}`,
          body: `Workflow: ${run.run.workflowTemplate.name} for ${run.contractorName}`,
          entityType: 'WORKFLOW_RUN',
          entityId: run.run.id,
          metadata: {
            taskTitle: task.title,
            workflowName: run.run.workflowTemplate.name,
            contractorName: run.contractorName,
          },
        }).catch(_err => {
          /* fire-and-forget */
        });
      }

      // Fire-and-forget: sync eligible tasks to external integrations
      void syncJiraTasksAfterStart(
        ctx.db,
        ctx.organizationId,
        run.run.tasks,
        run.jiraEligibleTaskRunIds,
      );
      void syncLinearTasksAfterStart(
        ctx.db,
        ctx.organizationId,
        run.run.tasks,
        run.linearEligibleTaskRuns,
      );
      void syncCalendarTasksAfterStart(
        ctx.db,
        ctx.organizationId,
        run.run.tasks,
        run.calendarConfigMap,
        run.contractorName,
        run.contractName,
        ctx.user.id,
      );

      // Fire-and-forget: handle EQUIPMENT task integration hooks (Phase 30)
      const equipmentTasks = run.run.tasks.filter(
        t => t.status !== 'SKIPPED' && run.equipmentEligibleTaskRunIds.has(t.id),
      );
      for (const eqTask of equipmentTasks) {
        void handleEquipmentTaskStart(ctx.db, ctx.organizationId, eqTask, {
          id: run.run.id,
          contractorId: run.run.contractorId,
          templateType: run.templateType,
        });
      }

      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return { ...run.run, calendarTaskCount: run.calendarTaskCount };
    }),


  /**
   * Cancel a workflow run. Sets all non-terminal tasks to CANCELLED.
   */
  cancelRun: tenantProcedure
    .use(requirePermission({ workflow: ['update'] }))
    .input(cancelRunSchema)
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.$transaction(async tx => {
        const existing = await findOrThrow(
          () =>
            tx.workflowRun.findFirst({
              where: {
                id: input.runId,
                organizationId: ctx.organizationId,
              },
            }),
          E.WORKFLOW_RUN_NOT_FOUND,
        );

        if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.WORKFLOW_RUN_ALREADY_CANCELLED,
          });
        }

        const now = new Date();

        // Cancel all non-terminal tasks
        await tx.workflowTaskRun.updateMany({
          where: {
            workflowRunId: input.runId,
            status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
          },
          data: { status: 'CANCELLED' },
        });

        const updated = await tx.workflowRun.update({
          where: { id: input.runId },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            cancelReason: input.reason ?? null,
          },
          include: {
            tasks: { orderBy: { createdAt: 'asc' } },
          },
        });

        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'workflow.run.cancelled',
          resourceType: 'WORKFLOW_RUN',
          resourceId: input.runId,
          newValues: {
            reason: input.reason ?? null,
            cancelledAt: updated.cancelledAt?.toISOString() ?? null,
          },
          tx,
        });

        return updated;
      });

      // Fire-and-forget outbound sync for cancelled tasks with external links
      // Per D-09/D-10: Linear and Jira always reflect real task state
      const cancelledTasks = run.tasks.filter(t => t.status === 'CANCELLED');
      for (const task of cancelledTasks) {
        syncTaskToExternalSystems(ctx.db, ctx.organizationId, task, 'CANCELLED');
      }

      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return run;
    }),


  /**
   * Get a workflow run by ID with full relations.
   */
  getRun: tenantProcedure
    .use(requirePermission({ workflow: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const run = await findOrThrow(
        () =>
          ctx.db.workflowRun.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.organizationId,
            },
            include: {
              tasks: { orderBy: { createdAt: 'asc' } },
              comments: {
                include: { author: { select: { id: true, name: true, image: true } } },
                orderBy: { createdAt: 'asc' },
              },
              workflowTemplate: { select: { id: true, name: true, type: true } },
              contractor: {
                select: {
                  id: true,
                  legalName: true,
                  displayName: true,
                  status: true,
                },
              },
              contract: {
                select: { id: true, title: true, status: true },
              },
            },
          }),
        E.WORKFLOW_RUN_NOT_FOUND,
      );

      const now = new Date();

      // Add computed isOverdue field to each task
      const tasksWithOverdue = run.tasks.map(task => ({
        ...task,
        isOverdue:
          task.dueAt !== null &&
          task.dueAt < now &&
          (task.status === 'TODO' || task.status === 'IN_PROGRESS'),
      }));

      return { ...run, tasks: tasksWithOverdue };
    }),


  /**
   * List workflow runs with pagination, sorting, and filtering.
   */
  listRuns: tenantProcedure
    .use(requirePermission({ workflow: ['read'] }))
    .input(workflowRunListSchema)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, sortBy, sortOrder, contractorId, filters } = input;

      const where: Record<string, unknown> = {
        organizationId: ctx.organizationId,
      };

      if (contractorId) {
        where.contractorId = contractorId;
      }

      if (filters?.status?.length) {
        where.status = { in: filters.status };
      }

      if (filters?.templateId?.length) {
        where.workflowTemplateId = { in: filters.templateId };
      }

      // Search by contractor name or template name
      if (search && search.length >= 2) {
        where.OR = [
          {
            contractor: {
              legalName: { contains: search, mode: 'insensitive' },
            },
          },
          {
            contractor: {
              displayName: { contains: search, mode: 'insensitive' },
            },
          },
          {
            workflowTemplate: {
              name: { contains: search, mode: 'insensitive' },
            },
          },
        ];
      }

      // Overdue filter: has tasks with dueAt < now and non-terminal status
      if (filters?.overdueOnly) {
        where.tasks = {
          some: {
            dueAt: { lt: new Date() },
            status: { in: ['TODO', 'IN_PROGRESS'] },
          },
        };
      }

      const [items, total] = await Promise.all([
        ctx.db.workflowRun.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          include: {
            workflowTemplate: { select: { name: true, type: true } },
            contractor: {
              select: { id: true, legalName: true, displayName: true },
            },
            tasks: {
              select: { status: true, resultJson: true },
            },
          },
        }),
        ctx.db.workflowRun.count({ where }),
      ]);

      // Compute progress for each run
      const itemsWithProgress = items.map(item => {
        const progress = calculateProgress(item.tasks);
        return { ...item, progress };
      });

      return { items: itemsWithProgress, total, page, pageSize };
    }),


  /**
   * Phase 75 D-12 — admin confirms completion of an offboarding run that still
   * has PENDING credentials. Requires a >=20-char reason and the IP_VERIFICATION
   * precondition to be satisfied (or overridden) — this mutation does NOT bypass
   * the IP block. Emits a single `workflow.completed_with_pending_credentials`
   * audit row.
   */
  forceCompleteRunWithPendingCredentials: tenantProcedure
    .use(requirePermission({ workflow: ['execute'] }))
    .input(
      z.object({
        workflowRunId: z.string().min(1),
        reason: z.string().min(20).max(2000),
        acknowledged: z.literal(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async tx => {
        const run = await tx.workflowRun.findFirst({
          where: { id: input.workflowRunId, organizationId: ctx.organizationId },
          select: { id: true, status: true },
        });
        if (!run) {
          throw new TRPCError({ code: 'NOT_FOUND', message: E.WORKFLOW_RUN_NOT_FOUND });
        }

        if (run.status !== 'IN_PROGRESS') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: E.WORKFLOW_RUN_NOT_IN_PROGRESS,
          });
        }

        // Defence-in-depth: the credential warning may be force-confirmed, but
        // the IP_VERIFICATION hard-block is NOT bypassed here (only via the
        // OWNER override mutation). Re-assert the IP precondition.
        const openIpTasks = await tx.workflowTaskRun.findMany({
          where: {
            workflowRunId: input.workflowRunId,
            organizationId: ctx.organizationId,
            taskType: 'IP_VERIFICATION',
            status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
          },
          select: { id: true },
        });
        if (openIpTasks.length > 0) {
          const fullRun = await tx.workflowRun.findUniqueOrThrow({
            where: { id: input.workflowRunId },
            select: { overrideMetadata: true },
          });
          const meta = fullRun.overrideMetadata;
          const overrideApplied =
            typeof meta === 'object' &&
            meta !== null &&
            'blockedTaskKind' in meta &&
            (meta as { blockedTaskKind?: string }).blockedTaskKind === 'IP_VERIFICATION';
          if (!overrideApplied) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: E.WORKFLOW_IP_VERIFICATION_OPEN,
              cause: {
                blockedTaskKind: 'IP_VERIFICATION' as const,
                openTaskIds: openIpTasks.map(t => t.id),
              } as never,
            });
          }
        }

        const pendingCount = await tx.credentialReference.count({
          where: {
            workflowRunId: input.workflowRunId,
            organizationId: ctx.organizationId,
            status: 'PENDING',
          },
        });

        const now = new Date();
        await tx.workflowRun.update({
          where: { id: input.workflowRunId },
          data: { status: 'COMPLETED', completedAt: now },
        });

        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'workflow.completed_with_pending_credentials',
          resourceType: 'WORKFLOW_RUN',
          resourceId: input.workflowRunId,
          newValues: {
            reason: input.reason,
            pendingCredentialsCount: pendingCount,
            completedAt: now.toISOString(),
          },
          tx,
        });

        return {
          workflowRunId: input.workflowRunId,
          completedAt: now,
          pendingCredentialsCount: pendingCount,
        };
      });
    }),
});

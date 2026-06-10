/**
 * Workflow task action procedures.
 */

import {
  myTasksListSchema,
  reassignTaskSchema,
  skipTaskSchema,
  taskActionSchema,
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
import { dispatch } from '../../services/notification-service';
import {
  unblockDependentsAndRecomputeRun,
  validateTransition,
} from './workflow-shared';
import { syncTaskToExternalSystems } from './workflow-execution-shared';

function assertWorkflowRunInProgress(runStatus: string): void {
  if (runStatus !== 'IN_PROGRESS') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: E.WORKFLOW_RUN_NOT_IN_PROGRESS,
    });
  }
}

function assertTaskAssignee(task: { assigneeUserId: string | null }, userId: string): void {
  if (task.assigneeUserId !== null && task.assigneeUserId !== userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: E.PERMISSION_DENIED,
    });
  }
}

export const workflowExecutionTasksRouter = router({


  /**
   * List tasks assigned to the current user.
   */
  myTasks: tenantProcedure
    .use(requirePermission({ workflow: ['read'] }))
    .input(myTasksListSchema)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, overdueOnly } = input;

      const where: Record<string, unknown> = {
        organizationId: ctx.organizationId,
        assigneeUserId: ctx.user.id,
        status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
      };

      if (overdueOnly) {
        where.dueAt = { lt: new Date() };
      }

      const [items, total] = await Promise.all([
        ctx.db.workflowTaskRun.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { dueAt: 'asc' },
          include: {
            workflowRun: {
              select: {
                id: true,
                status: true,
                contractor: {
                  select: { id: true, legalName: true, displayName: true },
                },
                workflowTemplate: { select: { name: true, type: true } },
              },
            },
          },
        }),
        ctx.db.workflowTaskRun.count({ where }),
      ]);

      const now = new Date();
      const itemsWithOverdue = items.map(item => ({
        ...item,
        isOverdue:
          item.dueAt !== null &&
          item.dueAt < now &&
          (item.status === 'TODO' || item.status === 'IN_PROGRESS'),
      }));

      return { items: itemsWithOverdue, total, page, pageSize };
    }),

  // =========================================================================
  // Task actions
  // =========================================================================


  /**
   * Complete a task. Unblocks dependent tasks and recomputes progress.
   */
  completeTask: tenantProcedure
    .use(requirePermission({ workflow: ['execute'] }))
    .input(taskActionSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const task = await findOrThrow(
          () =>
            tx.workflowTaskRun.findFirst({
              where: {
                id: input.taskRunId,
                organizationId: ctx.organizationId,
              },
              include: {
                workflowRun: { select: { id: true, status: true } },
              },
            }),
          E.WORKFLOW_TASK_NOT_FOUND,
        );

        assertWorkflowRunInProgress(task.workflowRun.status);
        assertTaskAssignee(task, ctx.user.id);

        if (!validateTransition(task.status, 'DONE')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.WORKFLOW_TASK_INVALID_STATUS,
          });
        }

        const now = new Date();

        // Update task to DONE
        const updated = await tx.workflowTaskRun.update({
          where: { id: input.taskRunId },
          data: {
            status: 'DONE',
            completedAt: now,
            completedByUserId: ctx.user.id,
            startedAt: task.startedAt ?? now,
          },
        });

        await unblockDependentsAndRecomputeRun(tx, task, now, {
          organizationId: ctx.organizationId,
        });

        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user.id,
          action: 'workflow.task.completed',
          resourceType: 'WORKFLOW_TASK_RUN',
          resourceId: input.taskRunId,
          newValues: {
            status: 'DONE',
            workflowRunId: task.workflowRun.id,
            previousStatus: task.status,
          },
          tx,
        });

        return updated;
      });

      // Fire-and-forget outbound sync to Jira and Linear
      syncTaskToExternalSystems(ctx.db, ctx.organizationId, result, 'DONE');

      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return result;
    }),


  /**
   * Skip a task with a reason. Unblocks dependents and recomputes progress.
   */
  skipTask: tenantProcedure
    .use(requirePermission({ workflow: ['execute'] }))
    .input(skipTaskSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const task = await findOrThrow(
          () =>
            tx.workflowTaskRun.findFirst({
              where: {
                id: input.taskRunId,
                organizationId: ctx.organizationId,
              },
              include: {
                workflowRun: { select: { id: true, status: true } },
              },
            }),
          E.WORKFLOW_TASK_NOT_FOUND,
        );

        if (!validateTransition(task.status, 'SKIPPED')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.WORKFLOW_TASK_CANNOT_SKIP,
          });
        }

        assertWorkflowRunInProgress(task.workflowRun.status);
        assertTaskAssignee(task, ctx.user.id);

        const updated = await tx.workflowTaskRun.update({
          where: { id: input.taskRunId },
          data: {
            status: 'SKIPPED',
            resultJson: { skipReason: input.reason },
          },
        });

        await unblockDependentsAndRecomputeRun(tx, task, new Date(), {
          organizationId: ctx.organizationId,
        });

        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user.id,
          action: 'workflow.task.skipped',
          resourceType: 'WORKFLOW_TASK_RUN',
          resourceId: input.taskRunId,
          newValues: {
            status: 'SKIPPED',
            workflowRunId: task.workflowRun.id,
            previousStatus: task.status,
            skipReason: input.reason,
          },
          tx,
        });

        return updated;
      });

      // Fire-and-forget outbound sync to Jira and Linear
      syncTaskToExternalSystems(ctx.db, ctx.organizationId, result, 'SKIPPED');

      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return result;
    }),


  /**
   * Reassign a task to a different user.
   */
  reassignTask: tenantProcedure
    .use(requirePermission({ workflow: ['update'] }))
    .input(reassignTaskSchema)
    .mutation(async ({ ctx, input }) => {
      await findOrThrow(
        () =>
          ctx.db.workflowTaskRun.findFirst({
            where: {
              id: input.taskRunId,
              organizationId: ctx.organizationId,
            },
          }),
        E.WORKFLOW_TASK_NOT_FOUND,
      );

      const assigneeMember = await ctx.db.member.findFirst({
        where: {
          organizationId: ctx.organizationId,
          userId: input.newAssigneeUserId,
        },
      });

      if (!assigneeMember) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.WORKFLOW_ASSIGNEE_NOT_MEMBER,
        });
      }

      const updated = await ctx.db.workflowTaskRun.update({
        where: { id: input.taskRunId },
        data: { assigneeUserId: input.newAssigneeUserId },
        include: {
          workflowRun: {
            select: {
              id: true,
              workflowTemplate: { select: { name: true } },
              contractor: { select: { legalName: true, displayName: true } },
            },
          },
        },
      });

      // Fire-and-forget: dispatch TASK_ASSIGNED to new assignee
      dispatch({
        organizationId: ctx.organizationId,
        type: 'TASK_ASSIGNED',
        recipientUserIds: [input.newAssigneeUserId],
        title: `Task assigned: ${updated.title}`,
        body: `Workflow: ${updated.workflowRun.workflowTemplate.name} for ${updated.workflowRun.contractor?.legalName ?? updated.workflowRun.contractor?.displayName ?? 'Unknown'}`,
        entityType: 'WORKFLOW_RUN',
        entityId: updated.workflowRun.id,
        metadata: {
          taskTitle: updated.title,
          workflowName: updated.workflowRun.workflowTemplate.name,
          contractorName:
            updated.workflowRun.contractor?.legalName ??
            updated.workflowRun.contractor?.displayName ??
            'Unknown',
        },
      }).catch(_err => {
        /* fire-and-forget */
      });

      return updated;
    }),

  // =========================================================================
  // Comments
  // =========================================================================


  /**
   * Count overdue tasks assigned to the current user.
   * Used for the sidebar navigation badge.
   */
  overdueCount: tenantProcedure
    .use(requirePermission({ workflow: ['read'] }))
    .query(async ({ ctx }) => {
      const count = await ctx.db.workflowTaskRun.count({
        where: {
          organizationId: ctx.organizationId,
          assigneeUserId: ctx.user.id,
          status: { in: ['TODO', 'IN_PROGRESS'] },
          dueAt: { lt: new Date() },
        },
      });

      return { count };
    }),


  /**
   * Phase 74 D-09 / D-10 / D-11 — OWNER-only override for the IP_VERIFICATION
   * blocking task. Atomically writes:
   *   1. WorkflowRun.overrideMetadata JSONB
   *   2. AuditLog row (action='workflow.offboarding.override_blocking_task')
   *   3. WorkflowTaskRun status SKIPPED for all open IP_VERIFICATION tasks
   * All in a single $transaction so a failure in any step rolls back the
   * others (T-74-08-partial-write mitigation).
   *
   * Server-side Zod re-validates reason length + acknowledged literal — the
   * client-side dialog is convenience UX only; this is the gate (Pitfall 5).
   * Permission gate is enforced via requirePermission middleware so 9
   * non-owner roles return FORBIDDEN before any DB work.
   */
  overrideBlockingTask: tenantProcedure
    .use(requirePermission({ workflow: ['override_blocking_task'] }))
    .input(
      z.object({
        workflowRunId: z.string().min(1),
        reason: z.string().min(20).max(2000),
        acknowledged: z.literal(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async tx => {
        await findOrThrow(
          () =>
            tx.workflowRun.findFirst({
              where: { id: input.workflowRunId, organizationId: ctx.organizationId },
              select: { id: true, overrideMetadata: true },
            }),
          'Workflow run not found',
        );

        // Find any open IP_VERIFICATION tasks on the run.
        const openIpTasks = await tx.workflowTaskRun.findMany({
          where: {
            workflowRunId: input.workflowRunId,
            organizationId: ctx.organizationId,
            taskType: 'IP_VERIFICATION',
            status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
          },
          select: { id: true },
        });
        if (openIpTasks.length === 0) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: E.PORTAL_NO_IP_VERIFICATION_TASK,
          });
        }

        // Skip all open IP_VERIFICATION tasks
        await tx.workflowTaskRun.updateMany({
          where: { id: { in: openIpTasks.map(t => t.id) } },
          data: {
            status: 'SKIPPED',
            resultJson: {
              skipReason: 'OVERRIDDEN_BY_OWNER',
              overriddenAt: new Date().toISOString(),
              overriddenByUserId: ctx.user.id,
              reason: input.reason,
            },
          },
        });

        const overrideCompletedAt = new Date();
        for (const ipTask of openIpTasks) {
          await unblockDependentsAndRecomputeRun(
            tx,
            { id: ipTask.id, workflowRun: { id: input.workflowRunId } },
            overrideCompletedAt,
            { organizationId: ctx.organizationId },
          );
        }

        // Write override metadata onto the run
        const overrideMetadata = {
          reason: input.reason,
          acknowledged: input.acknowledged,
          overriddenByUserId: ctx.user.id,
          overriddenAt: new Date().toISOString(),
          blockedTaskKind: 'IP_VERIFICATION' as const,
        };
        await tx.workflowRun.update({
          where: { id: input.workflowRunId },
          data: {
            overrideMetadata,
            overriddenByUserId: ctx.user.id,
            overriddenAt: new Date(),
          },
        });

        // Audit log row in the same transaction
        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user.id,
          action: 'workflow.offboarding.override_blocking_task',
          resourceType: 'WORKFLOW_RUN',
          resourceId: input.workflowRunId,
          newValues: {
            overrideMetadata,
            skippedTaskIds: openIpTasks.map(t => t.id),
          },
          tx,
        });

        return { workflowRunId: input.workflowRunId, overrideMetadata };
      });
    }),
});

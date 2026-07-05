/**
 * Workflow run lifecycle procedures.
 */

import type { StartRunInput } from '@contractor-ops/validators';
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
import type { OutboxTransactionalClient } from '../../services/outbox';
import { enqueueNotificationOutboxEvent } from '../../services/outbox';
import type { TxClient } from './workflow-execution-shared';
import {
  buildIntegrationEligibility,
  computeMaxDueDate,
  instantiateTaskRuns,
  syncCalendarTasksAfterStart,
  syncJiraTasksAfterStart,
  syncLinearTasksAfterStart,
  syncTaskToExternalSystems,
} from './workflow-execution-shared';
import { calculateProgress } from './workflow-shared';

/**
 * Enqueue a TASK_ASSIGNED notification per active (non-skipped, assigned)
 * task INSIDE the caller's transaction, so the notifications commit
 * atomically with the run + task-run inserts and are delivered exactly-once
 * by the outbox drain.
 */
async function enqueueTaskAssignedNotifications(
  tx: OutboxTransactionalClient,
  input: {
    organizationId: string;
    workflowRunId: string;
    workflowName: string;
    contractorName: string;
    tasks: { id: string; title: string; status: string; assigneeUserId: string | null }[];
  },
): Promise<void> {
  for (const task of input.tasks) {
    if (task.status === 'SKIPPED' || !task.assigneeUserId) continue;
    await enqueueNotificationOutboxEvent({
      tx,
      event: {
        organizationId: input.organizationId,
        type: 'TASK_ASSIGNED',
        recipientUserIds: [task.assigneeUserId],
        title: `Task assigned: ${task.title}`,
        body: `Workflow: ${input.workflowName} for ${input.contractorName}`,
        entityType: 'WORKFLOW_RUN',
        entityId: input.workflowRunId,
        metadata: {
          taskTitle: task.title,
          workflowName: input.workflowName,
          contractorName: input.contractorName,
        },
      },
      dedupKey: `task-assigned:${task.id}`,
    });
  }
}

/**
 * Instantiate a workflow run for either subject (contractor or employee worker)
 * inside a caller-supplied transaction. THE single owner of `tx.workflowRun.create`
 * — both `workflow.startRun` and the employee lifecycle router delegate here so
 * the create is never duplicated. The engine (`instantiateTaskRuns`), progress
 * calc, and the completion gate stay subject-agnostic and unchanged; only the
 * subject lookup + the run's subject columns branch on `input.subjectType`.
 */
export async function startWorkflowRun(
  tx: TxClient,
  input: StartRunInput,
  opts: { organizationId: string; actorUserId: string },
) {
  const { organizationId, actorUserId } = opts;

  const template = await findOrThrow(
    () =>
      tx.workflowTemplate.findFirst({
        where: { id: input.templateId, organizationId, status: 'ACTIVE' },
        include: { tasks: { orderBy: { sortOrder: 'asc' } } },
      }),
    E.WORKFLOW_TEMPLATE_NOT_FOUND,
  );

  const now = new Date();
  const maxDueDate = computeMaxDueDate(template.tasks, now);

  // Resolve exactly one subject. The subject bag feeds instantiateTaskRuns
  // (structurally typed `{ id; [k]: unknown }`), so a worker record satisfies it
  // with no engine change.
  let subject: { id: string; [k: string]: unknown };
  let entityType: 'CONTRACTOR' | 'EMPLOYEE';
  let contractorId: string | null = null;
  let workerId: string | null = null;
  let contract: { id: string; title: string | null; [k: string]: unknown } | null = null;
  let subjectDisplayName: string;

  if (input.subjectType === 'EMPLOYEE') {
    const worker = await findOrThrow(
      () =>
        tx.worker.findFirst({
          where: {
            id: input.workerId,
            organizationId,
            workerType: 'EMPLOYEE',
            deletedAt: null,
          },
        }),
      E.WORKER_NOT_FOUND,
    );
    subject = worker;
    entityType = 'EMPLOYEE';
    workerId = worker.id;
    subjectDisplayName = worker.displayName ?? 'Unknown';
  } else {
    const contractor = await findOrThrow(
      () =>
        tx.contractor.findFirst({
          where: { id: input.contractorId, organizationId, deletedAt: null },
        }),
      E.CONTRACTOR_NOT_FOUND,
    );
    subject = contractor;
    entityType = 'CONTRACTOR';
    contractorId = contractor.id;
    contract = input.contractId
      ? await tx.contract.findFirst({
          where: { id: input.contractId, organizationId, deletedAt: null },
        })
      : null;
    subjectDisplayName = contractor.legalName ?? contractor.displayName ?? 'Unknown';
  }

  const workflowRun = await tx.workflowRun.create({
    data: {
      organizationId,
      workflowTemplateId: template.id,
      entityType,
      entityId: subject.id,
      contractorId,
      workerId,
      contractId: contract?.id ?? null,
      status: 'IN_PROGRESS',
      startedByUserId: actorUserId,
      startedAt: now,
      dueAt: maxDueDate,
    },
  });

  // Instantiate all task runs from template tasks
  const taskIdMap = await instantiateTaskRuns(
    tx,
    organizationId,
    workflowRun.id,
    template.tasks,
    subject,
    contract,
    now,
  );

  // Compute initial progress
  const allTasks = await tx.workflowTaskRun.findMany({
    where: { workflowRunId: workflowRun.id },
  });
  const progress = calculateProgress(allTasks);

  // Collapse the previous `update + findUniqueOrThrow` pair into a
  // single `update({ include })` call to save one round-trip (and one
  // row lookup) inside the transaction. Prisma returns the full updated
  // row with the requested relations.
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

  // Audit the employee start (resourceType EMPLOYEE). The contractor path stays
  // byte-identical — it emitted no start audit before.
  if (entityType === 'EMPLOYEE') {
    await writeAuditLog({
      organizationId,
      actorType: 'USER',
      actorId: actorUserId,
      action: 'workflow.run.started',
      resourceType: 'EMPLOYEE',
      resourceId: subject.id,
      newValues: { workflowRunId: workflowRun.id, workflowTemplateId: template.id },
      tx,
    });
  }

  await enqueueTaskAssignedNotifications(tx as unknown as OutboxTransactionalClient, {
    organizationId,
    workflowRunId: fullRun.id,
    workflowName: fullRun.workflowTemplate.name,
    contractorName: subjectDisplayName,
    tasks: fullRun.tasks,
  });

  return {
    run: fullRun,
    subjectDisplayName,
    jiraEligibleTaskRunIds,
    linearEligibleTaskRuns,
    calendarConfigMap,
    calendarTaskCount: calendarConfigMap.size,
    contractName: contract?.title ?? '',
    equipmentEligibleTaskRunIds,
    templateType: template.type,
  };
}

export const workflowExecutionRunsRouter = router({
  /**
   * Start a workflow run from a template for a contractor or an employee worker.
   * Delegates the single run-create to the shared `startWorkflowRun` helper;
   * instantiates all task runs, evaluates conditions, resolves assignees.
   */
  startRun: tenantProcedure
    .use(requirePermission({ workflow: ['execute'] }))
    .input(startRunSchema)
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.$transaction(tx =>
        startWorkflowRun(tx, input, {
          organizationId: ctx.organizationId,
          actorUserId: ctx.user.id,
        }),
      );

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
        run.subjectDisplayName,
        run.contractName,
        ctx.user.id,
      );

      // Fire-and-forget: handle EQUIPMENT task integration hooks
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
      // Linear and Jira always reflect real task state
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
   * Admin confirms completion of an offboarding run that still has PENDING
   * credentials. Requires a >=20-char reason and the IP_VERIFICATION
   * precondition to be satisfied (or overridden) — this mutation does NOT
   * bypass the IP block. Emits a single
   * `workflow.completed_with_pending_credentials` audit row.
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

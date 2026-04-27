/**
 * Workflow execution procedures: run lifecycle (start, cancel, get, list),
 * task actions (complete, skip, reassign), comments, and overdue count.
 */

import type { Prisma } from '@contractor-ops/db';
import {
  addCommentSchema,
  calendarTaskConfigSchema,
  cancelRunSchema,
  equipmentTaskConfigSchema,
  jiraTaskConfigSchema,
  linearTaskConfigSchema,
  myTasksListSchema,
  reassignTaskSchema,
  skipTaskSchema,
  startRunSchema,
  taskActionSchema,
  workflowRunListSchema,
  workflowTaskSkipReason,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors.js';
import { router } from '../../init.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantProcedure } from '../../middleware/tenant.js';
import { writeAuditLog } from '../../services/audit-writer.js';
import { CacheKeys, invalidateByPrefix } from '../../services/cache.js';
import { handleEquipmentTaskStart } from '../../services/equipment-workflow.js';
import { dispatch } from '../../services/notification-service.js';
import type { DbClient } from '../../services/types.js';
import type { ConditionGroup } from './workflow-shared.js';
import {
  addDays,
  addHours,
  calculateProgress,
  evaluateCondition,
  resolveAssignee,
  validateTransition,
} from './workflow-shared.js';

/** Transaction client derived from the tenant-scoped DbClient. */
type TxClient = Parameters<Parameters<DbClient['$transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// Integration eligibility helpers
// ---------------------------------------------------------------------------

interface IntegrationEligibility {
  jiraEligibleTaskRunIds: Set<string>;
  linearEligibleTaskRuns: Map<string, { teamId: string; teamKey: string }>;
  calendarConfigMap: Map<string, import('@contractor-ops/validators').CalendarTaskConfig>;
  equipmentEligibleTaskRunIds: Set<string>;
}

/**
 * Scans template tasks and builds maps of which task run IDs are eligible
 * for Jira, Linear, Calendar, and Equipment integrations.
 */
function buildIntegrationEligibility(
  templateTasks: Array<{
    id: string;
    taskType: string;
    configJson: unknown;
  }>,
  taskIdMap: Map<string, string>,
): IntegrationEligibility {
  const jiraEligibleTaskRunIds = new Set<string>();
  const linearEligibleTaskRuns = new Map<string, { teamId: string; teamKey: string }>();
  const calendarConfigMap = new Map<
    string,
    import('@contractor-ops/validators').CalendarTaskConfig
  >();
  const equipmentEligibleTaskRunIds = new Set<string>();

  for (const taskTemplate of templateTasks) {
    const runId = taskIdMap.get(taskTemplate.id);
    if (!runId) continue;

    // Jira
    const jiraParsed = jiraTaskConfigSchema.safeParse(taskTemplate.configJson);
    if (jiraParsed.success && jiraParsed.data.jiraEnabled) {
      jiraEligibleTaskRunIds.add(runId);
    }

    // Linear
    const linearParsed = linearTaskConfigSchema.safeParse(taskTemplate.configJson);
    if (linearParsed.success && linearParsed.data.linearEnabled && linearParsed.data.linearTeamId) {
      linearEligibleTaskRuns.set(runId, {
        teamId: linearParsed.data.linearTeamId,
        teamKey: linearParsed.data.linearTeamKey ?? '',
      });
    }

    // Calendar
    const calParsed = calendarTaskConfigSchema.safeParse(taskTemplate.configJson);
    if (calParsed.success && calParsed.data.calendarEnabled) {
      calendarConfigMap.set(runId, calParsed.data);
    }

    // Equipment
    if (taskTemplate.taskType === 'EQUIPMENT') {
      const eqParsed = equipmentTaskConfigSchema.safeParse(taskTemplate.configJson);
      if (!eqParsed.success || eqParsed.data.equipmentEnabled !== false) {
        equipmentEligibleTaskRunIds.add(runId);
      }
    }
  }

  return {
    jiraEligibleTaskRunIds,
    linearEligibleTaskRuns,
    calendarConfigMap,
    equipmentEligibleTaskRunIds,
  };
}

/**
 * Fire-and-forget: syncs task status to external Jira and Linear integrations.
 */
function syncTaskToExternalSystems(
  db: DbClient,
  organizationId: string,
  task: { id: string; externalRefType: string | null; externalRefId: string | null },
  targetStatus: string,
) {
  if (task.externalRefType === 'JIRA_ISSUE' && task.externalRefId) {
    void (async () => {
      try {
        const { transitionJiraIssue } = await import('../../services/jira-issue-sync.js');
        const connection = await db.integrationConnection.findFirst({
          where: { organizationId, provider: 'JIRA', status: 'CONNECTED' },
          select: { id: true },
        });
        if (connection) {
          await transitionJiraIssue(db, organizationId, connection.id, task.id, targetStatus);
        }
      } catch (_err) {
        /* fire-and-forget */
      }
    })();
  }

  if (task.externalRefType === 'LINEAR_ISSUE' && task.externalRefId) {
    void (async () => {
      try {
        const { syncTaskStatusToLinear } = await import('../../services/linear-issue-sync.js');
        await syncTaskStatusToLinear(db, task.id, targetStatus);
      } catch (_err) {
        /* fire-and-forget */
      }
    })();
  }
}

// ---------------------------------------------------------------------------
// Task instantiation helpers
// ---------------------------------------------------------------------------

/**
 * Computes the latest due date across all template tasks based on offset days.
 */
function computeMaxDueDate(tasks: Array<{ dueOffsetDays: number | null }>, now: Date): Date | null {
  let maxDueDate: Date | null = null;
  for (const task of tasks) {
    if (!task.dueOffsetDays) continue;
    const taskDue = addDays(now, task.dueOffsetDays);
    if (!maxDueDate || taskDue > maxDueDate) maxDueDate = taskDue;
  }
  return maxDueDate;
}

/**
 * Resolves the initial status and resultJson for a task run based on
 * whether the condition was met and whether it has a dependency.
 */
function resolveTaskRunStatus(
  conditionMet: boolean,
  dependsOnRunId: string | null,
): { status: 'TODO' | 'BLOCKED' | 'SKIPPED'; resultJson: Record<string, unknown> | null } {
  if (!conditionMet) {
    return {
      status: 'SKIPPED',
      resultJson: { skipReason: workflowTaskSkipReason.conditionNotMet },
    };
  }
  return { status: dependsOnRunId ? 'BLOCKED' : 'TODO', resultJson: null };
}

/**
 * Computes the due date for a task run from offset days/hours.
 */
function computeTaskDueAt(
  conditionMet: boolean,
  dueOffsetDays: number | null,
  dueOffsetHours: number | null,
  now: Date,
): Date | null {
  if (!conditionMet) return null;
  let dueAt: Date | null = null;
  if (dueOffsetDays) dueAt = addDays(now, dueOffsetDays);
  if (dueOffsetHours) dueAt = addHours(dueAt ?? now, dueOffsetHours);
  return dueAt;
}

/**
 * Instantiates WorkflowTaskRun records for each template task.
 * Returns a map of template task ID -> run task ID.
 */
async function instantiateTaskRuns(
  tx: TxClient,
  organizationId: string,
  workflowRunId: string,
  templateTasks: Array<{
    id: string;
    configJson: unknown;
    title: string;
    description: string | null;
    taskType: string;
    required: boolean;
    assigneeMode: string;
    assigneeRole: string | null;
    assigneeUserId: string | null;
    dueOffsetDays: number | null;
    dueOffsetHours: number | null;
    dependsOnTaskTemplateId: string | null;
    sortOrder: number;
  }>,
  contractor: { id: string; [k: string]: unknown },
  contract: { id: string; [k: string]: unknown } | null,
  now: Date,
): Promise<Map<string, string>> {
  const taskIdMap = new Map<string, string>();

  for (const taskTemplate of templateTasks) {
    const condition = taskTemplate.configJson as ConditionGroup | null;
    const conditionMet = evaluateCondition(condition, {
      contractor,
      contract: contract ?? undefined,
    });

    const assigneeUserId = conditionMet
      ? await resolveAssignee(
          taskTemplate,
          contractor as { internalOwnerUserId?: string | null },
          contract as { internalOwnerUserId?: string | null } | null,
          organizationId,
          tx as unknown as Parameters<typeof resolveAssignee>[4],
        )
      : null;

    const dueAt = computeTaskDueAt(
      conditionMet,
      taskTemplate.dueOffsetDays,
      taskTemplate.dueOffsetHours,
      now,
    );

    const dependsOnRunId = taskTemplate.dependsOnTaskTemplateId
      ? (taskIdMap.get(taskTemplate.dependsOnTaskTemplateId) ?? null)
      : null;

    const { status, resultJson } = resolveTaskRunStatus(conditionMet, dependsOnRunId);

    const taskRun = await tx.workflowTaskRun.create({
      data: {
        organizationId,
        workflowRunId,
        workflowTaskTemplateId: taskTemplate.id,
        title: taskTemplate.title,
        description: taskTemplate.description,
        taskType: taskTemplate.taskType as Parameters<
          typeof tx.workflowTaskRun.create
        >[0]['data']['taskType'],
        required: taskTemplate.required,
        assigneeUserId,
        assigneeRole: taskTemplate.assigneeRole as Parameters<
          typeof tx.workflowTaskRun.create
        >[0]['data']['assigneeRole'],
        dueAt,
        dependsOnTaskRunId: dependsOnRunId,
        status,
        resultJson: (resultJson ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    taskIdMap.set(taskTemplate.id, taskRun.id);
  }

  return taskIdMap;
}

// ---------------------------------------------------------------------------
// Post-start integration dispatch helpers (fire-and-forget)
// ---------------------------------------------------------------------------

type TaskRunLike = { id: string; status: string; title: string; description: string | null };

/**
 * Creates Jira issues for TODO tasks that are Jira-eligible.
 */
async function syncJiraTasksAfterStart(
  db: DbClient,
  organizationId: string,
  tasks: TaskRunLike[],
  eligibleIds: Set<string>,
): Promise<void> {
  const todoTasks = tasks.filter(t => t.status === 'TODO' && eligibleIds.has(t.id));
  if (todoTasks.length === 0) return;

  try {
    const { createJiraIssue } = await import('../../services/jira-issue-sync.js');
    const connection = await db.integrationConnection.findFirst({
      where: { organizationId, provider: 'JIRA', status: 'CONNECTED' },
      select: { id: true },
    });
    if (!connection) return;

    for (const task of todoTasks) {
      createJiraIssue(db, organizationId, connection.id, task.id).catch(_err => {
        /* fire-and-forget */
      });
    }
  } catch (_err) {
    /* fire-and-forget */
  }
}

/**
 * Creates Linear issues for TODO tasks that are Linear-eligible.
 */
async function syncLinearTasksAfterStart(
  db: DbClient,
  organizationId: string,
  tasks: TaskRunLike[],
  eligibleRuns: Map<string, { teamId: string; teamKey: string }>,
): Promise<void> {
  const todoTasks = tasks.filter(t => t.status === 'TODO' && eligibleRuns.has(t.id));
  if (todoTasks.length === 0) return;

  try {
    const { createLinearIssue } = await import('../../services/linear-issue-sync.js');
    const linearConnection = await db.integrationConnection.findFirst({
      where: { organizationId, provider: 'LINEAR', status: 'CONNECTED' },
      select: { id: true },
    });
    if (!linearConnection) return;

    for (const task of todoTasks) {
      const linearConfig = eligibleRuns.get(task.id);
      if (!linearConfig) continue;
      createLinearIssue(db, {
        organizationId,
        connectionId: linearConnection.id,
        taskRunId: task.id,
        title: task.title,
        description: task.description ?? task.title,
        assigneeEmail: undefined,
        teamId: linearConfig.teamId,
        teamKey: linearConfig.teamKey,
      }).catch(_err => {
        /* fire-and-forget */
      });
    }
  } catch (_err) {
    /* fire-and-forget */
  }
}

/**
 * Creates calendar events for TODO tasks that are calendar-eligible.
 */
async function syncCalendarTasksAfterStart(
  db: DbClient,
  organizationId: string,
  tasks: TaskRunLike[],
  calendarConfigMap: Map<string, import('@contractor-ops/validators').CalendarTaskConfig>,
  contractorName: string,
  contractName: string,
  userId?: string,
): Promise<void> {
  if (calendarConfigMap.size === 0) return;

  const todoTasks = tasks.filter(t => t.status === 'TODO' && calendarConfigMap.has(t.id));
  if (todoTasks.length === 0) return;

  try {
    const { createTaskCalendarEvent } = await import('../../services/calendar-deadline-sync.js');
    for (const task of todoTasks) {
      const config = calendarConfigMap.get(task.id);
      if (!config) continue;
      createTaskCalendarEvent(db, {
        organizationId,
        workflowTaskRunId: task.id,
        config,
        contractorName,
        contractName,
        taskName: task.title,
        userId,
      }).catch(_err => {
        /* fire-and-forget */
      });
    }
  } catch (_err) {
    /* fire-and-forget */
  }
}

// ---------------------------------------------------------------------------
// Workflow Execution sub-router
// ---------------------------------------------------------------------------

export const workflowExecutionRouter = router({
  // =========================================================================
  // Workflow run operations
  // =========================================================================

  /**
   * Start a workflow run from a template for a specific contractor.
   * Instantiates all task runs, evaluates conditions, resolves assignees.
   */
  startRun: tenantProcedure
    .use(requirePermission({ workflow: ['execute'] }))
    .input(startRunSchema)
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.$transaction(async tx => {
        const template = await tx.workflowTemplate.findFirst({
          where: {
            id: input.templateId,
            organizationId: ctx.organizationId,
            status: 'ACTIVE',
          },
          include: { tasks: { orderBy: { sortOrder: 'asc' } } },
        });

        if (!template) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.WORKFLOW_TEMPLATE_NOT_FOUND,
          });
        }

        const contractor = await tx.contractor.findFirst({
          where: {
            id: input.contractorId,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
        });

        if (!contractor) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.CONTRACTOR_NOT_FOUND,
          });
        }

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

        await tx.workflowRun.update({
          where: { id: workflowRun.id },
          data: { progressPercent: progress.percent },
        });

        const fullRun = await tx.workflowRun.findUniqueOrThrow({
          where: { id: workflowRun.id },
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
        const existing = await tx.workflowRun.findFirst({
          where: {
            id: input.runId,
            organizationId: ctx.organizationId,
          },
        });

        if (!existing) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.WORKFLOW_RUN_NOT_FOUND,
          });
        }

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

        return tx.workflowRun.update({
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
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.db.workflowRun.findFirst({
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
      });

      if (!run) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.WORKFLOW_RUN_NOT_FOUND,
        });
      }

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
        const task = await tx.workflowTaskRun.findFirst({
          where: {
            id: input.taskRunId,
            organizationId: ctx.organizationId,
          },
          include: {
            workflowRun: { select: { id: true, status: true } },
          },
        });

        if (!task) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.WORKFLOW_TASK_NOT_FOUND,
          });
        }

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

        // Unblock dependent tasks
        await tx.workflowTaskRun.updateMany({
          where: {
            dependsOnTaskRunId: task.id,
            status: 'BLOCKED',
          },
          data: { status: 'TODO' },
        });

        // Recompute run progress
        const allTasks = await tx.workflowTaskRun.findMany({
          where: { workflowRunId: task.workflowRun.id },
        });
        const progress = calculateProgress(allTasks);

        // Check if run is complete (all active tasks done or skipped)
        const isComplete = progress.done === progress.total && progress.total > 0;

        await tx.workflowRun.update({
          where: { id: task.workflowRun.id },
          data: {
            progressPercent: progress.percent,
            ...(isComplete ? { status: 'COMPLETED', completedAt: now } : {}),
          },
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
        const task = await tx.workflowTaskRun.findFirst({
          where: {
            id: input.taskRunId,
            organizationId: ctx.organizationId,
          },
          include: {
            workflowRun: { select: { id: true, status: true } },
          },
        });

        if (!task) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.WORKFLOW_TASK_NOT_FOUND,
          });
        }

        if (!validateTransition(task.status, 'SKIPPED')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.WORKFLOW_TASK_CANNOT_SKIP,
          });
        }

        const updated = await tx.workflowTaskRun.update({
          where: { id: input.taskRunId },
          data: {
            status: 'SKIPPED',
            resultJson: { skipReason: input.reason },
          },
        });

        // Unblock dependent tasks
        await tx.workflowTaskRun.updateMany({
          where: {
            dependsOnTaskRunId: task.id,
            status: 'BLOCKED',
          },
          data: { status: 'TODO' },
        });

        // Recompute run progress
        const allTasks = await tx.workflowTaskRun.findMany({
          where: { workflowRunId: task.workflowRun.id },
        });
        const progress = calculateProgress(allTasks);

        const isComplete = progress.done === progress.total && progress.total > 0;

        await tx.workflowRun.update({
          where: { id: task.workflowRun.id },
          data: {
            progressPercent: progress.percent,
            ...(isComplete ? { status: 'COMPLETED', completedAt: new Date() } : {}),
          },
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
      const task = await ctx.db.workflowTaskRun.findFirst({
        where: {
          id: input.taskRunId,
          organizationId: ctx.organizationId,
        },
      });

      if (!task) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.WORKFLOW_TASK_NOT_FOUND,
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
   * Add a comment to a workflow run or task.
   */
  addComment: tenantProcedure
    .use(requirePermission({ workflow: ['update'] }))
    .input(addCommentSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify run belongs to org
      const run = await ctx.db.workflowRun.findFirst({
        where: {
          id: input.workflowRunId,
          organizationId: ctx.organizationId,
        },
      });

      if (!run) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.WORKFLOW_RUN_NOT_FOUND,
        });
      }

      const comment = await ctx.db.workflowComment.create({
        data: {
          organizationId: ctx.organizationId,
          workflowRunId: input.workflowRunId,
          workflowTaskRunId: input.workflowTaskRunId ?? null,
          authorUserId: ctx.user.id,
          body: input.body,
        },
        include: {
          author: { select: { id: true, name: true, image: true } },
        },
      });

      return comment;
    }),

  /**
   * List comments for a workflow run, optionally filtered by task.
   */
  listComments: tenantProcedure
    .use(requirePermission({ workflow: ['read'] }))
    .input(
      z.object({
        workflowRunId: z.string(),
        workflowTaskRunId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        organizationId: ctx.organizationId,
        workflowRunId: input.workflowRunId,
      };

      if (input.workflowTaskRunId) {
        where.workflowTaskRunId = input.workflowTaskRunId;
      }

      const comments = await ctx.db.workflowComment.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      return comments;
    }),

  // =========================================================================
  // Overdue count (sidebar badge)
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
        const run = await tx.workflowRun.findFirst({
          where: { id: input.workflowRunId, organizationId: ctx.organizationId },
          select: { id: true, overrideMetadata: true },
        });
        if (!run) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Workflow run not found' });
        }

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
            message: 'No open IP_VERIFICATION task to override',
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

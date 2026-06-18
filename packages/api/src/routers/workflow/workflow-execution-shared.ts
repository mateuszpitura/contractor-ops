/**
 * Shared helpers for workflow execution sub-routers.
 */

import { randomUUID } from 'node:crypto';
import type { Prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import {
  calendarTaskConfigSchema,
  equipmentTaskConfigSchema,
  jiraTaskConfigSchema,
  linearTaskConfigSchema,
  workflowTaskSkipReason,
} from '@contractor-ops/validators';
import type { DbClient } from '../../services/types';
import type { ConditionGroup } from './workflow-shared';
import { addDays, addHours, evaluateCondition, resolveAssignee } from './workflow-shared';

/** Transaction client derived from the tenant-scoped DbClient. */
export type TxClient = Parameters<Parameters<DbClient['$transaction']>[0]>[0];

export interface IntegrationEligibility {
  jiraEligibleTaskRunIds: Set<string>;
  linearEligibleTaskRuns: Map<string, { teamId: string; teamKey: string }>;
  calendarConfigMap: Map<string, import('@contractor-ops/validators').CalendarTaskConfig>;
  equipmentEligibleTaskRunIds: Set<string>;
}

/**
 * Scans template tasks and builds maps of which task run IDs are eligible
 * for Jira, Linear, Calendar, and Equipment integrations.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: per-task scan that safeParses four independent integration configs and conditionally populates four eligibility maps
export function buildIntegrationEligibility(
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

    const jiraParsed = jiraTaskConfigSchema.safeParse(taskTemplate.configJson);
    if (jiraParsed.success && jiraParsed.data.jiraEnabled) {
      jiraEligibleTaskRunIds.add(runId);
    }

    const linearParsed = linearTaskConfigSchema.safeParse(taskTemplate.configJson);
    if (linearParsed.success && linearParsed.data.linearEnabled && linearParsed.data.linearTeamId) {
      linearEligibleTaskRuns.set(runId, {
        teamId: linearParsed.data.linearTeamId,
        teamKey: linearParsed.data.linearTeamKey ?? '',
      });
    }

    const calParsed = calendarTaskConfigSchema.safeParse(taskTemplate.configJson);
    if (calParsed.success && calParsed.data.calendarEnabled) {
      calendarConfigMap.set(runId, calParsed.data);
    }

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

export const log = createLogger({ service: 'workflow-execution' });

/**
 * Fire-and-forget: syncs task status to external Jira and Linear integrations.
 */
export function syncTaskToExternalSystems(
  db: DbClient,
  organizationId: string,
  task: { id: string; externalRefType: string | null; externalRefId: string | null },
  targetStatus: string,
) {
  if (task.externalRefType === 'JIRA_ISSUE' && task.externalRefId) {
    void (async () => {
      try {
        const { transitionJiraIssue } = await import('../../services/jira-issue-sync');
        const connection = await db.integrationConnection.findFirst({
          where: { organizationId, provider: 'JIRA', status: 'CONNECTED' },
          select: { id: true },
        });
        if (connection) {
          await transitionJiraIssue(db, organizationId, connection.id, task.id, targetStatus);
        }
      } catch (err) {
        log.warn(
          { err, organizationId, taskId: task.id, targetStatus },
          'Jira task status sync failed',
        );
      }
    })();
  }

  if (task.externalRefType === 'LINEAR_ISSUE' && task.externalRefId) {
    void (async () => {
      try {
        const { syncTaskStatusToLinear } = await import('../../services/linear-issue-sync');
        await syncTaskStatusToLinear(db, task.id, targetStatus);
      } catch (err) {
        log.warn(
          { err, organizationId, taskId: task.id, targetStatus },
          'Linear task status sync failed',
        );
      }
    })();
  }
}

export function computeMaxDueDate(
  tasks: Array<{ dueOffsetDays: number | null }>,
  now: Date,
): Date | null {
  let maxDueDate: Date | null = null;
  for (const task of tasks) {
    if (!task.dueOffsetDays) continue;
    const taskDue = addDays(now, task.dueOffsetDays);
    if (!maxDueDate || taskDue > maxDueDate) maxDueDate = taskDue;
  }
  return maxDueDate;
}

export function resolveTaskRunStatus(
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

export function computeTaskDueAt(
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

export async function instantiateTaskRuns(
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
  for (const t of templateTasks) {
    taskIdMap.set(t.id, randomUUID());
  }

  const conditions = templateTasks.map(t => ({
    template: t,
    conditionMet: evaluateCondition(t.configJson as ConditionGroup | null, {
      contractor,
      contract: contract ?? undefined,
    }),
  }));

  const assignees = await Promise.all(
    conditions.map(({ template, conditionMet }) =>
      conditionMet
        ? resolveAssignee(
            template,
            contractor as { internalOwnerUserId?: string | null },
            contract as { internalOwnerUserId?: string | null } | null,
            organizationId,
            tx,
          )
        : Promise.resolve(null),
    ),
  );

  type WorkflowTaskRunCreateInput = Parameters<
    typeof tx.workflowTaskRun.createMany
  >[0]['data'] extends infer D
    ? D extends Array<infer R>
      ? R
      : D
    : never;

  const data: WorkflowTaskRunCreateInput[] = conditions.map(({ template, conditionMet }, i) => {
    const dueAt = computeTaskDueAt(
      conditionMet,
      template.dueOffsetDays,
      template.dueOffsetHours,
      now,
    );

    const dependsOnRunId = template.dependsOnTaskTemplateId
      ? (taskIdMap.get(template.dependsOnTaskTemplateId) ?? null)
      : null;

    const { status, resultJson } = resolveTaskRunStatus(conditionMet, dependsOnRunId);

    return {
      id: taskIdMap.get(template.id) as string,
      organizationId,
      workflowRunId,
      workflowTaskTemplateId: template.id,
      title: template.title,
      description: template.description,
      taskType: template.taskType as Parameters<
        typeof tx.workflowTaskRun.create
      >[0]['data']['taskType'],
      required: template.required,
      assigneeUserId: assignees[i] ?? null,
      assigneeRole: template.assigneeRole as Parameters<
        typeof tx.workflowTaskRun.create
      >[0]['data']['assigneeRole'],
      dueAt,
      dependsOnTaskRunId: dependsOnRunId,
      status,
      resultJson: (resultJson ?? undefined) as Prisma.InputJsonValue | undefined,
    } as WorkflowTaskRunCreateInput;
  });

  if (data.length > 0) {
    await tx.workflowTaskRun.createMany({ data });
  }

  return taskIdMap;
}

export type TaskRunLike = { id: string; status: string; title: string; description: string | null };

export async function syncJiraTasksAfterStart(
  db: DbClient,
  organizationId: string,
  tasks: TaskRunLike[],
  eligibleIds: Set<string>,
): Promise<void> {
  const todoTasks = tasks.filter(t => t.status === 'TODO' && eligibleIds.has(t.id));
  if (todoTasks.length === 0) return;

  try {
    const { createJiraIssue } = await import('../../services/jira-issue-sync');
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
    // safe-swallow: best-effort external issue sync; a setup failure must not
    // block workflow execution (the fire-and-forget calls own their errors).
  } catch (_err) {
    /* fire-and-forget */
  }
}

export async function syncLinearTasksAfterStart(
  db: DbClient,
  organizationId: string,
  tasks: TaskRunLike[],
  eligibleRuns: Map<string, { teamId: string; teamKey: string }>,
): Promise<void> {
  const todoTasks = tasks.filter(t => t.status === 'TODO' && eligibleRuns.has(t.id));
  if (todoTasks.length === 0) return;

  try {
    const { createLinearIssue } = await import('../../services/linear-issue-sync');
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
    // safe-swallow: best-effort external issue sync; a setup failure must not
    // block workflow execution (the fire-and-forget calls own their errors).
  } catch (_err) {
    /* fire-and-forget */
  }
}

export async function syncCalendarTasksAfterStart(
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
    const { createTaskCalendarEvent } = await import('../../services/calendar-deadline-sync');
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
    // safe-swallow: best-effort external issue sync; a setup failure must not
    // block workflow execution (the fire-and-forget calls own their errors).
  } catch (_err) {
    /* fire-and-forget */
  }
}

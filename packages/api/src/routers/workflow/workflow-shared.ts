/**
 * Shared constants, helpers, and types for the workflow domain routers.
 * Used by workflow-templates.ts and workflow-execution.ts.
 */

import { userRoleToMemberRole } from '@contractor-ops/auth/role-normalization';
import type { Prisma } from '@contractor-ops/db';
import { workflowTaskSkipReason } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import type { ResolveAssigneeWithPtoArgs } from '../../services/pto-detector';
import { resolveAssigneeWithPto } from '../../services/pto-detector';

// Re-export for overrideBlockingTask, startOffboardingRun, and any other
// workflow-execution code that needs PTO-aware assignee resolution.
// Resolution runs ONCE at task creation time — no per-render re-resolution.
export { type ResolveAssigneeWithPtoArgs, resolveAssigneeWithPto };

// ---------------------------------------------------------------------------
// i18n workflow template key constants
// ---------------------------------------------------------------------------

export const WORKFLOW_TEMPLATE_KEYS = {
  onboarding: {
    collectNda: 'workflow.templates.onboarding.collectNda',
    signContract: 'workflow.templates.onboarding.signContract',
    setupItAccess: 'workflow.templates.onboarding.setupItAccess',
    setupFinance: 'workflow.templates.onboarding.setupFinance',
    provisionEquipment: 'workflow.templates.onboarding.provisionEquipment',
    teamIntroMeeting: 'workflow.templates.onboarding.teamIntroMeeting',
    knowledgeTransfer: 'workflow.templates.onboarding.knowledgeTransfer',
  },
  offboarding: {
    knowledgeTransfer: 'workflow.templates.offboarding.knowledgeTransfer',
    revokeItAccess: 'workflow.templates.offboarding.revokeItAccess',
    returnEquipment: 'workflow.templates.offboarding.returnEquipment',
    financeWrapUp: 'workflow.templates.offboarding.financeWrapUp',
    finalDocumentation: 'workflow.templates.offboarding.finalDocumentation',
    ipVerification: 'workflow.templates.offboarding.ipVerification',
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Add days to a date, returning a new Date instance.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add hours to a date, returning a new Date instance.
 */
export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setTime(result.getTime() + hours * 60 * 60 * 1000);
  return result;
}

// ---------------------------------------------------------------------------
// Condition evaluator
// ---------------------------------------------------------------------------

export interface ConditionRule {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'startsWith';
  value: string;
}

export interface ConditionGroup {
  combinator: 'AND' | 'OR';
  rules: ConditionRule[];
}

/**
 * Get a nested field value from an object using dot notation.
 * e.g., "contractor.type" -> context.contractor.type
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[key]
          : undefined,
      obj,
    );
}

/**
 * Pure function that evaluates a condition group against a runtime context.
 * Returns true if condition is null/empty (no condition = always include).
 */
export function evaluateCondition(
  condition: ConditionGroup | null,
  context: { contractor: Record<string, unknown>; contract?: Record<string, unknown> },
): boolean {
  if (!condition?.rules || condition.rules.length === 0) {
    return true;
  }

  const results = condition.rules.map(rule => {
    const fieldValue = getNestedValue(context as Record<string, unknown>, rule.field);
    const strValue = String(fieldValue ?? '');

    switch (rule.operator) {
      case 'equals':
        return strValue === rule.value;
      case 'notEquals':
        return strValue !== rule.value;
      case 'contains':
        return strValue.includes(rule.value);
      case 'startsWith':
        return strValue.startsWith(rule.value);
      default:
        return false;
    }
  });

  return condition.combinator === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

// ---------------------------------------------------------------------------
// Assignee resolver
// ---------------------------------------------------------------------------

/**
 * Resolves an assignee user ID based on the task's assignee mode.
 * Returns null if no matching user is found (task will be unassigned).
 *
 * Subject-agnostic: employee (worker) runs use ROLE_BASED (HR roles) or
 * FIXED_USER assignees. The owner modes return null for an employee subject —
 * a worker bag carries no `internalOwnerUserId` — instead of throwing, so an
 * employee template that ever uses an owner mode degrades to unassigned.
 */
export async function resolveAssignee(
  task: { assigneeMode: string; assigneeUserId?: string | null; assigneeRole?: string | null },
  contractor: { internalOwnerUserId?: string | null },
  contract: { internalOwnerUserId?: string | null } | null,
  orgId: string,
  tx: {
    member: {
      findFirst: (args?: Prisma.MemberFindFirstArgs) => Promise<{ userId: string } | null>;
    };
  },
): Promise<string | null> {
  switch (task.assigneeMode) {
    case 'FIXED_USER':
      return task.assigneeUserId ?? null;
    case 'ROLE_BASED': {
      if (!task.assigneeRole) return null;
      const memberRole = userRoleToMemberRole(task.assigneeRole);
      if (!memberRole) return null;
      const member = await tx.member.findFirst({
        where: {
          organizationId: orgId,
          role: memberRole,
          user: { banned: false },
        },
      });
      return member?.userId ?? null;
    }
    case 'CONTRACTOR_OWNER':
      return contractor.internalOwnerUserId ?? null;
    case 'CONTRACT_OWNER':
      return contract?.internalOwnerUserId ?? null;
    case 'PROJECT_MANAGER':
      return null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Progress calculator
// ---------------------------------------------------------------------------

/**
 * Calculate workflow run progress, excluding condition-skipped tasks
 * from both numerator and denominator.
 */
export function calculateProgress(tasks: Array<{ status: string; resultJson?: unknown }>): {
  done: number;
  total: number;
  percent: number;
} {
  // Exclude condition-skipped tasks from the total
  const activeTasks = tasks.filter(t => {
    if (
      t.status === 'SKIPPED' &&
      (t.resultJson as Record<string, unknown>)?.skipReason ===
        workflowTaskSkipReason.conditionNotMet
    ) {
      return false;
    }
    return true;
  });

  const done = activeTasks.filter(t => t.status === 'DONE' || t.status === 'SKIPPED').length;
  const total = activeTasks.length;

  return {
    done,
    total,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// Task status transition map
// ---------------------------------------------------------------------------

export const TASK_TRANSITIONS: Record<string, string[]> = {
  TODO: ['IN_PROGRESS', 'SKIPPED', 'CANCELLED'],
  IN_PROGRESS: ['DONE', 'SKIPPED', 'CANCELLED'],
  BLOCKED: ['TODO'],
  DONE: [],
  SKIPPED: [],
  CANCELLED: [],
  OVERDUE: ['DONE', 'SKIPPED', 'CANCELLED'],
};

export function validateTransition(current: string, target: string): boolean {
  return (TASK_TRANSITIONS[current] ?? []).includes(target);
}

// ---------------------------------------------------------------------------
// Task lifecycle postlude
// ---------------------------------------------------------------------------

/**
 * Shared postlude for task transitions that close a task (DONE or SKIPPED):
 * unblock dependents, recompute the parent run's progress, and complete the
 * run if every active task is now done. Used by both completeTask and
 * skipTask which previously inlined this 4-step block.
 */
export async function unblockDependentsAndRecomputeRun(
  tx: {
    workflowTaskRun: {
      updateMany: (args: Prisma.WorkflowTaskRunUpdateManyArgs) => Promise<unknown>;
      findMany: (
        args: Prisma.WorkflowTaskRunFindManyArgs,
      ) => Promise<Array<{ status: string; resultJson?: unknown }>>;
    };
    workflowRun: {
      update: (args: Prisma.WorkflowRunUpdateArgs) => Promise<unknown>;
      findUniqueOrThrow?: (
        args: Prisma.WorkflowRunFindUniqueOrThrowArgs,
      ) => Promise<{ overrideMetadata: unknown }>;
    };
    credentialReference?: {
      findMany: (
        args: Prisma.CredentialReferenceFindManyArgs,
      ) => Promise<Array<{ id: string; label: string; vaultProvider: string }>>;
    };
  },
  closedTask: { id: string; workflowRun: { id: string } },
  completedAt: Date,
  // When supplied, run-completion is gated on open IP_VERIFICATION tasks
  // (hard-block) + PENDING credentials (soft-warning).
  // Omitted by callers that do not need the gate (preserves existing behaviour).
  gate?: { organizationId: string },
): Promise<void> {
  await tx.workflowTaskRun.updateMany({
    where: {
      dependsOnTaskRunId: closedTask.id,
      status: 'BLOCKED',
    },
    data: { status: 'TODO' },
  });

  const allTasks = await tx.workflowTaskRun.findMany({
    where: { workflowRunId: closedTask.workflowRun.id },
  });
  const progress = calculateProgress(allTasks);
  const isComplete = progress.done === progress.total && progress.total > 0;

  if (isComplete && gate && tx.workflowRun.findUniqueOrThrow && tx.credentialReference) {
    await assertRunCompletable(
      tx as unknown as RunGateClient,
      closedTask.workflowRun.id,
      gate.organizationId,
    );
  }

  await tx.workflowRun.update({
    where: { id: closedTask.workflowRun.id },
    data: {
      progressPercent: progress.percent,
      ...(isComplete ? { status: 'COMPLETED', completedAt } : {}),
    },
  });
}

interface RunGateClient {
  workflowTaskRun: {
    findMany: (args: Prisma.WorkflowTaskRunFindManyArgs) => Promise<Array<{ id: string }>>;
  };
  workflowRun: {
    findUniqueOrThrow: (
      args: Prisma.WorkflowRunFindUniqueOrThrowArgs,
    ) => Promise<{ overrideMetadata: unknown }>;
  };
  credentialReference: {
    findMany: (
      args: Prisma.CredentialReferenceFindManyArgs,
    ) => Promise<Array<{ id: string; label: string; vaultProvider: string }>>;
  };
}

/**
 * Gate offboarding-run completion.
 * Throws PRECONDITION_FAILED with a structured `cause` when an IP_VERIFICATION
 * task is still open (unless the owner override is applied) or when PENDING
 * credentials remain. The UI inspects `cause.blockedTaskKind` to route the
 * admin to the e-sign / override / force-complete flow.
 */
export async function assertRunCompletable(
  tx: RunGateClient,
  workflowRunId: string,
  organizationId: string,
): Promise<void> {
  const fullRun = await tx.workflowRun.findUniqueOrThrow({
    where: { id: workflowRunId },
    select: { overrideMetadata: true },
  });
  const meta = fullRun.overrideMetadata;
  const overrideApplied =
    typeof meta === 'object' &&
    meta !== null &&
    'blockedTaskKind' in meta &&
    (meta as { blockedTaskKind?: string }).blockedTaskKind === 'IP_VERIFICATION';

  if (!overrideApplied) {
    const openIpTasks = await tx.workflowTaskRun.findMany({
      where: {
        workflowRunId,
        organizationId,
        taskType: 'IP_VERIFICATION',
        status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
      },
      select: { id: true },
    });
    if (openIpTasks.length > 0) {
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

  const pendingCreds = await tx.credentialReference.findMany({
    where: { workflowRunId, organizationId, status: 'PENDING' },
    select: { id: true, label: true, vaultProvider: true },
  });
  if (pendingCreds.length > 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: E.WORKFLOW_CREDENTIALS_PENDING,
      cause: {
        blockedTaskKind: 'PENDING_CREDENTIALS' as const,
        pendingCredentials: pendingCreds,
        pendingCount: pendingCreds.length,
      } as never,
    });
  }
}

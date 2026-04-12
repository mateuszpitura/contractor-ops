/**
 * Shared constants, helpers, and types for the workflow domain routers.
 * Used by workflow-templates.ts and workflow-execution.ts.
 */

// ---------------------------------------------------------------------------
// i18n workflow template key constants
// ---------------------------------------------------------------------------

export const WORKFLOW_TEMPLATE_KEYS = {
  onboarding: {
    collectNda: "workflow.templates.onboarding.collectNda",
    signContract: "workflow.templates.onboarding.signContract",
    setupItAccess: "workflow.templates.onboarding.setupItAccess",
    setupFinance: "workflow.templates.onboarding.setupFinance",
    provisionEquipment: "workflow.templates.onboarding.provisionEquipment",
    teamIntroMeeting: "workflow.templates.onboarding.teamIntroMeeting",
    knowledgeTransfer: "workflow.templates.onboarding.knowledgeTransfer",
  },
  offboarding: {
    knowledgeTransfer: "workflow.templates.offboarding.knowledgeTransfer",
    revokeItAccess: "workflow.templates.offboarding.revokeItAccess",
    returnEquipment: "workflow.templates.offboarding.returnEquipment",
    financeWrapUp: "workflow.templates.offboarding.financeWrapUp",
    finalDocumentation: "workflow.templates.offboarding.finalDocumentation",
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strips Prisma class prototype from query results, producing plain
 * JSON-serializable objects so that inferred tRPC router types do NOT
 * reference the generated Prisma client module (avoids TS2742).
 */
export function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

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
  operator: "equals" | "notEquals" | "contains" | "startsWith";
  value: string;
}

export interface ConditionGroup {
  combinator: "AND" | "OR";
  rules: ConditionRule[];
}

/**
 * Get a nested field value from an object using dot notation.
 * e.g., "contractor.type" -> context.contractor.type
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((current, key) => current?.[key], obj);
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

  const results = condition.rules.map((rule) => {
    const fieldValue = getNestedValue(context as Record<string, unknown>, rule.field);
    const strValue = String(fieldValue ?? "");

    switch (rule.operator) {
      case "equals":
        return strValue === rule.value;
      case "notEquals":
        return strValue !== rule.value;
      case "contains":
        return strValue.includes(rule.value);
      case "startsWith":
        return strValue.startsWith(rule.value);
      default:
        return false;
    }
  });

  return condition.combinator === "AND" ? results.every(Boolean) : results.some(Boolean);
}

// ---------------------------------------------------------------------------
// Assignee resolver
// ---------------------------------------------------------------------------

/**
 * Resolves an assignee user ID based on the task's assignee mode.
 * Returns null if no matching user is found (task will be unassigned).
 */
export async function resolveAssignee(
  task: { assigneeMode: string; assigneeUserId?: string | null; assigneeRole?: string | null },
  contractor: { internalOwnerUserId?: string | null },
  contract: { internalOwnerUserId?: string | null } | null,
  orgId: string,
  tx: { member: { findFirst: (args: unknown) => Promise<{ userId: string } | null> } },
): Promise<string | null> {
  switch (task.assigneeMode) {
    case "FIXED_USER":
      return task.assigneeUserId ?? null;
    case "ROLE_BASED": {
      const member = await tx.member.findFirst({
        where: {
          organizationId: orgId,
          role: task.assigneeRole,
          user: { banned: false },
        },
      });
      return member?.userId ?? null;
    }
    case "CONTRACTOR_OWNER":
      return contractor.internalOwnerUserId ?? null;
    case "CONTRACT_OWNER":
      return contract?.internalOwnerUserId ?? null;
    case "PROJECT_MANAGER":
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
  const activeTasks = tasks.filter((t) => {
    if (
      t.status === "SKIPPED" &&
      (t.resultJson as Record<string, unknown>)?.skipReason === "condition_not_met"
    ) {
      return false;
    }
    return true;
  });

  const done = activeTasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED").length;
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
  TODO: ["IN_PROGRESS", "SKIPPED", "CANCELLED"],
  IN_PROGRESS: ["DONE", "SKIPPED", "CANCELLED"],
  BLOCKED: ["TODO"],
  DONE: [],
  SKIPPED: [],
  CANCELLED: [],
  OVERDUE: ["DONE", "SKIPPED", "CANCELLED"],
};

export function validateTransition(current: string, target: string): boolean {
  return (TASK_TRANSITIONS[current] ?? []).includes(target);
}

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@contractor-ops/db";
import {
  templateCreateSchema,
  templateUpdateSchema,
  templateListSchema,
  startRunSchema,
  workflowRunListSchema,
  cancelRunSchema,
  taskActionSchema,
  skipTaskSchema,
  reassignTaskSchema,
  addCommentSchema,
  myTasksListSchema,
} from "@contractor-ops/validators";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strips Prisma class prototype from query results, producing plain
 * JSON-serializable objects so that inferred tRPC router types do NOT
 * reference the generated Prisma client module (avoids TS2742).
 */
function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

/**
 * Add days to a date, returning a new Date instance.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add hours to a date, returning a new Date instance.
 */
function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setTime(result.getTime() + hours * 60 * 60 * 1000);
  return result;
}

// ---------------------------------------------------------------------------
// Condition evaluator
// ---------------------------------------------------------------------------

interface ConditionRule {
  field: string;
  operator: "equals" | "notEquals" | "contains" | "startsWith";
  value: string;
}

interface ConditionGroup {
  combinator: "AND" | "OR";
  rules: ConditionRule[];
}

/**
 * Get a nested field value from an object using dot notation.
 * e.g., "contractor.type" -> context.contractor.type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNestedValue(obj: Record<string, any>, path: string): unknown {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

/**
 * Pure function that evaluates a condition group against a runtime context.
 * Returns true if condition is null/empty (no condition = always include).
 */
export function evaluateCondition(
  condition: ConditionGroup | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: { contractor: any; contract?: any },
): boolean {
  if (!condition || !condition.rules || condition.rules.length === 0) {
    return true;
  }

  const results = condition.rules.map((rule) => {
    const fieldValue = getNestedValue(
      context as unknown as Record<string, unknown>,
      rule.field,
    );
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

  return condition.combinator === "AND"
    ? results.every(Boolean)
    : results.some(Boolean);
}

// ---------------------------------------------------------------------------
// Assignee resolver
// ---------------------------------------------------------------------------

/**
 * Resolves an assignee user ID based on the task's assignee mode.
 * Returns null if no matching user is found (task will be unassigned).
 */
export async function resolveAssignee(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  task: { assigneeMode: string; assigneeUserId?: string | null; assigneeRole?: string | null },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contractor: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contract: any | null,
  orgId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
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
export function calculateProgress(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: Array<{ status: string; resultJson?: any }>,
): { done: number; total: number; percent: number } {
  // Exclude condition-skipped tasks from the total
  const activeTasks = tasks.filter((t) => {
    if (
      t.status === "SKIPPED" &&
      (t.resultJson as Record<string, unknown>)?.skipReason ===
        "condition_not_met"
    ) {
      return false;
    }
    return true;
  });

  const done = activeTasks.filter(
    (t) => t.status === "DONE" || t.status === "SKIPPED",
  ).length;
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

function validateTransition(current: string, target: string): boolean {
  return (TASK_TRANSITIONS[current] ?? []).includes(target);
}

// ---------------------------------------------------------------------------
// Workflow router
// ---------------------------------------------------------------------------

export const workflowRouter = router({
  // =========================================================================
  // Template CRUD
  // =========================================================================

  /**
   * Create a new workflow template with task definitions.
   */
  createTemplate: tenantProcedure
    .use(requirePermission({ workflow: ["create"] }))
    .input(templateCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const template = await prisma.$transaction(async (tx) => {
        const created = await tx.workflowTemplate.create({
          data: {
            organizationId: ctx.organizationId,
            name: input.name,
            type: input.type,
            description: input.description ?? null,
            version: 1,
            status: "DRAFT",
            appliesToEntityType: "CONTRACTOR",
            createdByUserId: ctx.user!.id,
          },
        });

        if (input.tasks.length > 0) {
          await tx.workflowTaskTemplate.createMany({
            data: input.tasks.map((task) => ({
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
          include: { tasks: { orderBy: { sortOrder: "asc" } } },
        });
      });

      return plain(template);
    }),

  /**
   * Update a workflow template. Tasks are replaced (delete all + recreate).
   */
  updateTemplate: tenantProcedure
    .use(requirePermission({ workflow: ["update"] }))
    .input(templateUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const template = await prisma.$transaction(async (tx) => {
        const existing = await tx.workflowTemplate.findFirst({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
          },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workflow template not found",
          });
        }

        // Update template fields
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: Record<string, any> = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.type !== undefined) updateData.type = input.type;
        if (input.description !== undefined)
          updateData.description = input.description;
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
              data: input.tasks.map((task) => ({
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
                dependsOnTaskTemplateId:
                  task.dependsOnTaskTemplateId ?? null,
                externalUrl: task.externalUrl || null,
                configJson: task.conditions ?? undefined,
              })),
            });
          }
        }

        return tx.workflowTemplate.findUniqueOrThrow({
          where: { id: input.id },
          include: { tasks: { orderBy: { sortOrder: "asc" } } },
        });
      });

      return plain(template);
    }),

  /**
   * Get a workflow template by ID with tasks.
   */
  getTemplate: tenantProcedure
    .use(requirePermission({ workflow: ["read"] }))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await prisma.workflowTemplate.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: { tasks: { orderBy: { sortOrder: "asc" } } },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow template not found",
        });
      }

      return plain(template);
    }),

  /**
   * List workflow templates with pagination, search, and status filter.
   */
  listTemplates: tenantProcedure
    .use(requirePermission({ workflow: ["read"] }))
    .input(templateListSchema)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, status } = input;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
        organizationId: ctx.organizationId,
      };

      if (status?.length) {
        where.status = { in: status };
      }

      if (search && search.length >= 2) {
        where.name = { contains: search, mode: "insensitive" };
      }

      const [items, total] = await Promise.all([
        prisma.workflowTemplate.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { runs: true, tasks: true } },
          },
        }),
        prisma.workflowTemplate.count({ where }),
      ]);

      return plain({ items, total, page, pageSize });
    }),

  /**
   * Delete a workflow template (only DRAFT with no runs).
   */
  deleteTemplate: tenantProcedure
    .use(requirePermission({ workflow: ["delete"] }))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const template = await prisma.workflowTemplate.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: { _count: { select: { runs: true } } },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow template not found",
        });
      }

      if (template.status !== "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Only draft templates can be deleted. Archive the template instead.",
        });
      }

      if (template._count.runs > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Cannot delete a template that has existing runs. Archive it instead.",
        });
      }

      await prisma.$transaction(async (tx) => {
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
    .use(requirePermission({ workflow: ["create"] }))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const source = await prisma.workflowTemplate.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: { tasks: { orderBy: { sortOrder: "asc" } } },
      });

      if (!source) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow template not found",
        });
      }

      const duplicate = await prisma.$transaction(async (tx) => {
        const created = await tx.workflowTemplate.create({
          data: {
            organizationId: ctx.organizationId,
            name: `${source.name} (copy)`,
            type: source.type,
            description: source.description,
            version: 1,
            status: "DRAFT",
            appliesToEntityType: source.appliesToEntityType,
            createdByUserId: ctx.user!.id,
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
          include: { tasks: { orderBy: { sortOrder: "asc" } } },
        });
      });

      return plain(duplicate);
    }),

  // =========================================================================
  // Workflow run operations
  // =========================================================================

  /**
   * Start a workflow run from a template for a specific contractor.
   * Instantiates all task runs, evaluates conditions, resolves assignees.
   */
  startRun: tenantProcedure
    .use(requirePermission({ workflow: ["execute"] }))
    .input(startRunSchema)
    .mutation(async ({ ctx, input }) => {
      const run = await prisma.$transaction(async (tx) => {
        const template = await tx.workflowTemplate.findFirst({
          where: {
            id: input.templateId,
            organizationId: ctx.organizationId,
            status: "ACTIVE",
          },
          include: { tasks: { orderBy: { sortOrder: "asc" } } },
        });

        if (!template) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Workflow template not found or not active. Only active templates can be started.",
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
            code: "NOT_FOUND",
            message: "Contractor not found",
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
        let maxDueDate: Date | null = null;
        for (const task of template.tasks) {
          if (task.dueOffsetDays) {
            const taskDue = addDays(now, task.dueOffsetDays);
            if (!maxDueDate || taskDue > maxDueDate) {
              maxDueDate = taskDue;
            }
          }
        }

        const workflowRun = await tx.workflowRun.create({
          data: {
            organizationId: ctx.organizationId,
            workflowTemplateId: template.id,
            entityType: "CONTRACTOR",
            entityId: contractor.id,
            contractorId: contractor.id,
            contractId: contract?.id ?? null,
            status: "IN_PROGRESS",
            startedByUserId: ctx.user!.id,
            startedAt: now,
            dueAt: maxDueDate,
          },
        });

        // Map template task IDs to run task IDs for dependency resolution
        const taskIdMap = new Map<string, string>();

        for (const taskTemplate of template.tasks) {
          const condition = taskTemplate.configJson as ConditionGroup | null;
          const conditionMet = evaluateCondition(condition, {
            contractor,
            contract,
          });

          const assigneeUserId = conditionMet
            ? await resolveAssignee(
                taskTemplate,
                contractor,
                contract,
                ctx.organizationId,
                tx,
              )
            : null;

          let dueAt: Date | null = null;
          if (conditionMet) {
            if (taskTemplate.dueOffsetDays) {
              dueAt = addDays(now, taskTemplate.dueOffsetDays);
            }
            if (taskTemplate.dueOffsetHours) {
              dueAt = addHours(dueAt ?? now, taskTemplate.dueOffsetHours);
            }
          }

          const dependsOnRunId = taskTemplate.dependsOnTaskTemplateId
            ? taskIdMap.get(taskTemplate.dependsOnTaskTemplateId) ?? null
            : null;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let resultJson: any = null;

          const status = !conditionMet
            ? ("SKIPPED" as const)
            : dependsOnRunId
              ? ("BLOCKED" as const)
              : ("TODO" as const);

          if (!conditionMet) {
            resultJson = { skipReason: "condition_not_met" };
          }

          const taskRun = await tx.workflowTaskRun.create({
            data: {
              organizationId: ctx.organizationId,
              workflowRunId: workflowRun.id,
              workflowTaskTemplateId: taskTemplate.id,
              title: taskTemplate.title,
              description: taskTemplate.description,
              taskType: taskTemplate.taskType,
              required: taskTemplate.required,
              assigneeUserId,
              assigneeRole: taskTemplate.assigneeRole,
              dueAt,
              dependsOnTaskRunId: dependsOnRunId,
              status,
              resultJson,
            },
          });

          taskIdMap.set(taskTemplate.id, taskRun.id);
        }

        // Compute initial progress
        const allTasks = await tx.workflowTaskRun.findMany({
          where: { workflowRunId: workflowRun.id },
        });
        const progress = calculateProgress(allTasks);

        await tx.workflowRun.update({
          where: { id: workflowRun.id },
          data: { progressPercent: progress.percent },
        });

        return tx.workflowRun.findUniqueOrThrow({
          where: { id: workflowRun.id },
          include: {
            tasks: { orderBy: { createdAt: "asc" } },
            workflowTemplate: { select: { name: true, type: true } },
          },
        });
      });

      return plain(run);
    }),

  /**
   * Cancel a workflow run. Sets all non-terminal tasks to CANCELLED.
   */
  cancelRun: tenantProcedure
    .use(requirePermission({ workflow: ["update"] }))
    .input(cancelRunSchema)
    .mutation(async ({ ctx, input }) => {
      const run = await prisma.$transaction(async (tx) => {
        const existing = await tx.workflowRun.findFirst({
          where: {
            id: input.runId,
            organizationId: ctx.organizationId,
          },
        });

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workflow run not found",
          });
        }

        if (
          existing.status === "COMPLETED" ||
          existing.status === "CANCELLED"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot cancel a run that is already ${existing.status}`,
          });
        }

        const now = new Date();

        // Cancel all non-terminal tasks
        await tx.workflowTaskRun.updateMany({
          where: {
            workflowRunId: input.runId,
            status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] },
          },
          data: { status: "CANCELLED" },
        });

        return tx.workflowRun.update({
          where: { id: input.runId },
          data: {
            status: "CANCELLED",
            cancelledAt: now,
            cancelReason: input.reason ?? null,
          },
          include: {
            tasks: { orderBy: { createdAt: "asc" } },
          },
        });
      });

      return plain(run);
    }),

  /**
   * Get a workflow run by ID with full relations.
   */
  getRun: tenantProcedure
    .use(requirePermission({ workflow: ["read"] }))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const run = await prisma.workflowRun.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          tasks: { orderBy: { createdAt: "asc" } },
          comments: {
            include: { author: { select: { id: true, name: true, image: true } } },
            orderBy: { createdAt: "asc" },
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
          code: "NOT_FOUND",
          message: "Workflow run not found",
        });
      }

      const now = new Date();

      // Add computed isOverdue field to each task
      const tasksWithOverdue = run.tasks.map((task) => ({
        ...task,
        isOverdue:
          task.dueAt !== null &&
          task.dueAt < now &&
          (task.status === "TODO" || task.status === "IN_PROGRESS"),
      }));

      return plain({ ...run, tasks: tasksWithOverdue });
    }),

  /**
   * List workflow runs with pagination, sorting, and filtering.
   */
  listRuns: tenantProcedure
    .use(requirePermission({ workflow: ["read"] }))
    .input(workflowRunListSchema)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, sortBy, sortOrder, contractorId, filters } =
        input;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
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
              legalName: { contains: search, mode: "insensitive" },
            },
          },
          {
            contractor: {
              displayName: { contains: search, mode: "insensitive" },
            },
          },
          {
            workflowTemplate: {
              name: { contains: search, mode: "insensitive" },
            },
          },
        ];
      }

      // Overdue filter: has tasks with dueAt < now and non-terminal status
      if (filters?.overdueOnly) {
        where.tasks = {
          some: {
            dueAt: { lt: new Date() },
            status: { in: ["TODO", "IN_PROGRESS"] },
          },
        };
      }

      const [items, total] = await Promise.all([
        prisma.workflowRun.findMany({
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
        prisma.workflowRun.count({ where }),
      ]);

      // Compute progress for each run
      const itemsWithProgress = items.map((item) => {
        const progress = calculateProgress(item.tasks);
        return { ...item, progress };
      });

      return plain({ items: itemsWithProgress, total, page, pageSize });
    }),

  /**
   * List tasks assigned to the current user.
   */
  myTasks: tenantProcedure
    .use(requirePermission({ workflow: ["read"] }))
    .input(myTasksListSchema)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, overdueOnly } = input;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
        organizationId: ctx.organizationId,
        assigneeUserId: ctx.user!.id,
        status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] },
      };

      if (overdueOnly) {
        where.dueAt = { lt: new Date() };
      }

      const [items, total] = await Promise.all([
        prisma.workflowTaskRun.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { dueAt: "asc" },
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
        prisma.workflowTaskRun.count({ where }),
      ]);

      const now = new Date();
      const itemsWithOverdue = items.map((item) => ({
        ...item,
        isOverdue:
          item.dueAt !== null &&
          item.dueAt < now &&
          (item.status === "TODO" || item.status === "IN_PROGRESS"),
      }));

      return plain({ items: itemsWithOverdue, total, page, pageSize });
    }),

  // =========================================================================
  // Task actions
  // =========================================================================

  /**
   * Complete a task. Unblocks dependent tasks and recomputes progress.
   */
  completeTask: tenantProcedure
    .use(requirePermission({ workflow: ["execute"] }))
    .input(taskActionSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.$transaction(async (tx) => {
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
            code: "NOT_FOUND",
            message: "Task not found",
          });
        }

        if (!validateTransition(task.status, "DONE")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot complete a task with status ${task.status}. Allowed transitions: ${(TASK_TRANSITIONS[task.status] ?? []).join(", ") || "none"}`,
          });
        }

        const now = new Date();

        // Update task to DONE
        const updated = await tx.workflowTaskRun.update({
          where: { id: input.taskRunId },
          data: {
            status: "DONE",
            completedAt: now,
            completedByUserId: ctx.user!.id,
            startedAt: task.startedAt ?? now,
          },
        });

        // Unblock dependent tasks
        await tx.workflowTaskRun.updateMany({
          where: {
            dependsOnTaskRunId: task.id,
            status: "BLOCKED",
          },
          data: { status: "TODO" },
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
            ...(isComplete
              ? { status: "COMPLETED", completedAt: now }
              : {}),
          },
        });

        return updated;
      });

      return plain(result);
    }),

  /**
   * Skip a task with a reason. Unblocks dependents and recomputes progress.
   */
  skipTask: tenantProcedure
    .use(requirePermission({ workflow: ["execute"] }))
    .input(skipTaskSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.$transaction(async (tx) => {
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
            code: "NOT_FOUND",
            message: "Task not found",
          });
        }

        if (!validateTransition(task.status, "SKIPPED")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot skip a task with status ${task.status}`,
          });
        }

        const updated = await tx.workflowTaskRun.update({
          where: { id: input.taskRunId },
          data: {
            status: "SKIPPED",
            resultJson: { skipReason: input.reason },
          },
        });

        // Unblock dependent tasks
        await tx.workflowTaskRun.updateMany({
          where: {
            dependsOnTaskRunId: task.id,
            status: "BLOCKED",
          },
          data: { status: "TODO" },
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
            ...(isComplete
              ? { status: "COMPLETED", completedAt: new Date() }
              : {}),
          },
        });

        return updated;
      });

      return plain(result);
    }),

  /**
   * Reassign a task to a different user.
   */
  reassignTask: tenantProcedure
    .use(requirePermission({ workflow: ["update"] }))
    .input(reassignTaskSchema)
    .mutation(async ({ ctx, input }) => {
      const task = await prisma.workflowTaskRun.findFirst({
        where: {
          id: input.taskRunId,
          organizationId: ctx.organizationId,
        },
      });

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found",
        });
      }

      const updated = await prisma.workflowTaskRun.update({
        where: { id: input.taskRunId },
        data: { assigneeUserId: input.newAssigneeUserId },
      });

      return plain(updated);
    }),

  // =========================================================================
  // Comments
  // =========================================================================

  /**
   * Add a comment to a workflow run or task.
   */
  addComment: tenantProcedure
    .use(requirePermission({ workflow: ["update"] }))
    .input(addCommentSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify run belongs to org
      const run = await prisma.workflowRun.findFirst({
        where: {
          id: input.workflowRunId,
          organizationId: ctx.organizationId,
        },
      });

      if (!run) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow run not found",
        });
      }

      const comment = await prisma.workflowComment.create({
        data: {
          organizationId: ctx.organizationId,
          workflowRunId: input.workflowRunId,
          workflowTaskRunId: input.workflowTaskRunId ?? null,
          authorUserId: ctx.user!.id,
          body: input.body,
        },
        include: {
          author: { select: { id: true, name: true, image: true } },
        },
      });

      return plain(comment);
    }),

  /**
   * List comments for a workflow run, optionally filtered by task.
   */
  listComments: tenantProcedure
    .use(requirePermission({ workflow: ["read"] }))
    .input(
      z.object({
        workflowRunId: z.string(),
        workflowTaskRunId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
        organizationId: ctx.organizationId,
        workflowRunId: input.workflowRunId,
      };

      if (input.workflowTaskRunId) {
        where.workflowTaskRunId = input.workflowTaskRunId;
      }

      const comments = await prisma.workflowComment.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      return plain(comments);
    }),

  // =========================================================================
  // Overdue count (sidebar badge)
  // =========================================================================

  /**
   * Count overdue tasks assigned to the current user.
   * Used for the sidebar navigation badge.
   */
  overdueCount: tenantProcedure
    .use(requirePermission({ workflow: ["read"] }))
    .query(async ({ ctx }) => {
      const count = await prisma.workflowTaskRun.count({
        where: {
          organizationId: ctx.organizationId,
          assigneeUserId: ctx.user!.id,
          status: { in: ["TODO", "IN_PROGRESS"] },
          dueAt: { lt: new Date() },
        },
      });

      return { count };
    }),

  // =========================================================================
  // Starter template seeding
  // =========================================================================

  /**
   * Seed starter templates (Onboarding + Offboarding) for the org.
   * No-op if any templates already exist. Called from Templates tab on first visit.
   */
  seedStarterTemplates: tenantProcedure
    .use(requirePermission({ workflow: ["create"] }))
    .mutation(async ({ ctx }) => {
      const existingCount = await prisma.workflowTemplate.count({
        where: { organizationId: ctx.organizationId },
      });

      if (existingCount > 0) {
        return { seeded: false };
      }

      await prisma.$transaction(async (tx) => {
        // ----- Template 1: Contractor Onboarding -----
        const onboarding = await tx.workflowTemplate.create({
          data: {
            organizationId: ctx.organizationId,
            name: "Contractor Onboarding",
            type: "ONBOARDING",
            description:
              "Standard onboarding workflow for new contractors. Review and customize tasks before activating.",
            version: 1,
            status: "DRAFT",
            appliesToEntityType: "CONTRACTOR",
            createdByUserId: ctx.user!.id,
          },
        });

        const onboardingTasks = [
          {
            title: "Collect NDA",
            taskType: "DOCUMENT_COLLECTION" as const,
            assigneeRole: "OPS_MANAGER" as const,
            dueOffsetDays: 2,
            sortOrder: 0,
          },
          {
            title: "Sign contract",
            taskType: "APPROVAL" as const,
            assigneeRole: "LEGAL_VIEWER" as const,
            dueOffsetDays: 5,
            sortOrder: 1,
          },
          {
            title: "Set up IT access",
            taskType: "ACCESS_GRANT" as const,
            assigneeRole: "IT_ADMIN" as const,
            dueOffsetDays: 3,
            sortOrder: 2,
          },
          {
            title: "Set up finance",
            taskType: "FINANCE_SETUP" as const,
            assigneeRole: "FINANCE_ADMIN" as const,
            dueOffsetDays: 3,
            sortOrder: 3,
          },
          {
            title: "Provision equipment",
            taskType: "EQUIPMENT" as const,
            assigneeRole: "OPS_MANAGER" as const,
            dueOffsetDays: 5,
            sortOrder: 4,
          },
          {
            title: "Team introduction meeting",
            taskType: "MEETING" as const,
            assigneeRole: "TEAM_MANAGER" as const,
            dueOffsetDays: 7,
            sortOrder: 5,
          },
          {
            title: "Knowledge transfer",
            taskType: "KNOWLEDGE_TRANSFER" as const,
            assigneeRole: "TEAM_MANAGER" as const,
            dueOffsetDays: 14,
            sortOrder: 6,
          },
        ];

        await tx.workflowTaskTemplate.createMany({
          data: onboardingTasks.map((task) => ({
            organizationId: ctx.organizationId,
            workflowTemplateId: onboarding.id,
            title: task.title,
            taskType: task.taskType,
            assigneeMode: "ROLE_BASED" as const,
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
            name: "Contractor Offboarding",
            type: "OFFBOARDING",
            description:
              "Standard offboarding workflow for departing contractors. Review and customize tasks before activating.",
            version: 1,
            status: "DRAFT",
            appliesToEntityType: "CONTRACTOR",
            createdByUserId: ctx.user!.id,
          },
        });

        const offboardingTasks = [
          {
            title: "Knowledge transfer",
            taskType: "KNOWLEDGE_TRANSFER" as const,
            assigneeRole: "TEAM_MANAGER" as const,
            dueOffsetDays: 7,
            sortOrder: 0,
          },
          {
            title: "Revoke IT access",
            taskType: "ACCESS_REVOKE" as const,
            assigneeRole: "IT_ADMIN" as const,
            dueOffsetDays: 1,
            sortOrder: 1,
          },
          {
            title: "Return equipment",
            taskType: "EQUIPMENT" as const,
            assigneeRole: "OPS_MANAGER" as const,
            dueOffsetDays: 5,
            sortOrder: 2,
          },
          {
            title: "Finance wrap-up",
            taskType: "FINANCE_SETUP" as const,
            assigneeRole: "FINANCE_ADMIN" as const,
            dueOffsetDays: 3,
            sortOrder: 3,
          },
          {
            title: "Final documentation",
            taskType: "DOCUMENT_COLLECTION" as const,
            assigneeRole: "OPS_MANAGER" as const,
            dueOffsetDays: 5,
            sortOrder: 4,
          },
        ];

        await tx.workflowTaskTemplate.createMany({
          data: offboardingTasks.map((task) => ({
            organizationId: ctx.organizationId,
            workflowTemplateId: offboarding.id,
            title: task.title,
            taskType: task.taskType,
            assigneeMode: "ROLE_BASED" as const,
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

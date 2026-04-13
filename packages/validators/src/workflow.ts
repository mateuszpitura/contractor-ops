import { z } from 'zod';
import { optionalFk, optionalString } from './helpers.js';

// ---------------------------------------------------------------------------
// Prisma enum mirrors (string unions — validators package has no Prisma dep)
// ---------------------------------------------------------------------------

export const workflowTemplateTypeEnum = z.enum([
  'ONBOARDING',
  'OFFBOARDING',
  'DOCUMENT_COLLECTION',
  'COMPLIANCE_REVIEW',
  'CUSTOM',
]);

export const workflowTemplateStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);

export const workflowTaskTypeEnum = z.enum([
  'DOCUMENT_COLLECTION',
  'APPROVAL',
  'ACCESS_GRANT',
  'ACCESS_REVOKE',
  'FINANCE_SETUP',
  'EQUIPMENT',
  'KNOWLEDGE_TRANSFER',
  'MEETING',
  'MANUAL',
  'NOTIFICATION',
]);

export const assigneeModeEnum = z.enum([
  'FIXED_USER',
  'ROLE_BASED',
  'CONTRACTOR_OWNER',
  'CONTRACT_OWNER',
  'PROJECT_MANAGER',
]);

export const workflowRunStatusEnum = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'BLOCKED',
  'OVERDUE',
]);

export const workflowTaskStatusEnum = z.enum([
  'TODO',
  'IN_PROGRESS',
  'DONE',
  'BLOCKED',
  'SKIPPED',
  'CANCELLED',
  'OVERDUE',
]);

export const userRoleEnum = z.enum([
  'ORG_ADMIN',
  'FINANCE_ADMIN',
  'OPS_MANAGER',
  'TEAM_MANAGER',
  'LEGAL_VIEWER',
  'IT_ADMIN',
  'ACCOUNTANT',
  'READ_ONLY',
]);

// ---------------------------------------------------------------------------
// Condition schemas (AND/OR rule builder for conditional task logic)
// ---------------------------------------------------------------------------

export const conditionRuleSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['equals', 'notEquals', 'contains', 'startsWith']),
  value: z.string().min(1),
});

export const conditionGroupSchema = z.object({
  combinator: z.enum(['AND', 'OR']),
  rules: z.array(conditionRuleSchema).min(1),
});

// ---------------------------------------------------------------------------
// Task template input schema (used within template create/update)
// ---------------------------------------------------------------------------

export const taskTemplateInputSchema = z.object({
  title: z.string().min(1).max(255),
  description: optionalString,
  taskType: workflowTaskTypeEnum,
  sortOrder: z.number().int().nonnegative(),
  required: z.boolean(),
  assigneeMode: assigneeModeEnum,
  assigneeRole: userRoleEnum.optional(),
  assigneeUserId: optionalFk,
  dueOffsetDays: z.number().int().nonnegative().optional(),
  dueOffsetHours: z.number().int().nonnegative().optional(),
  dependsOnTaskTemplateId: optionalFk,
  externalUrl: z.string().url().optional().or(z.literal('')),
  conditions: conditionGroupSchema.nullable().optional(),
});

// ---------------------------------------------------------------------------
// Template CRUD schemas
// ---------------------------------------------------------------------------

export const templateCreateSchema = z.object({
  name: z.string().min(1).max(255),
  type: workflowTemplateTypeEnum,
  description: z.string().optional(),
  tasks: z.array(taskTemplateInputSchema).min(1),
});

export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;

export const templateUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  type: workflowTemplateTypeEnum.optional(),
  description: z.string().nullable().optional(),
  status: workflowTemplateStatusEnum.optional(),
  tasks: z.array(taskTemplateInputSchema.extend({ id: z.string().optional() })).optional(),
});

export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;

export const templateListSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(10).max(50).default(25),
  search: z.string().optional(),
  status: z.array(workflowTemplateStatusEnum).optional(),
});

export type TemplateListInput = z.infer<typeof templateListSchema>;

// ---------------------------------------------------------------------------
// Workflow run schemas
// ---------------------------------------------------------------------------

export const startRunSchema = z.object({
  templateId: z.string().min(1),
  contractorId: z.string().min(1),
  contractId: optionalFk,
});

export type StartRunInput = z.infer<typeof startRunSchema>;

export const workflowRunListSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(10).max(50).default(25),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'dueAt', 'status', 'startedAt']).default('dueAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  contractorId: z.string().optional(),
  filters: z
    .object({
      status: z.array(z.string()).optional(),
      templateId: z.array(z.string()).optional(),
      overdueOnly: z.boolean().optional(),
    })
    .optional(),
});

export type WorkflowRunListInput = z.infer<typeof workflowRunListSchema>;

export const cancelRunSchema = z.object({
  runId: z.string().min(1),
  reason: z.string().min(3).max(500).optional(),
});

export type CancelRunInput = z.infer<typeof cancelRunSchema>;

// ---------------------------------------------------------------------------
// Task action schemas
// ---------------------------------------------------------------------------

export const taskActionSchema = z.object({
  taskRunId: z.string().min(1),
});

export type TaskActionInput = z.infer<typeof taskActionSchema>;

export const skipTaskSchema = z.object({
  taskRunId: z.string().min(1),
  reason: z.string().min(3).max(500),
});

export type SkipTaskInput = z.infer<typeof skipTaskSchema>;

export const reassignTaskSchema = z.object({
  taskRunId: z.string().min(1),
  newAssigneeUserId: z.string().min(1),
});

export type ReassignTaskInput = z.infer<typeof reassignTaskSchema>;

// ---------------------------------------------------------------------------
// Comment and attachment schemas
// ---------------------------------------------------------------------------

export const addCommentSchema = z.object({
  workflowRunId: z.string().min(1),
  workflowTaskRunId: optionalFk,
  body: z.string().min(1).max(5000),
});

export type AddCommentInput = z.infer<typeof addCommentSchema>;

// ---------------------------------------------------------------------------
// My tasks and overdue schemas
// ---------------------------------------------------------------------------

export const myTasksListSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(10).max(50).default(25),
  overdueOnly: z.boolean().optional(),
});

export type MyTasksListInput = z.infer<typeof myTasksListSchema>;

/** Written to WorkflowTaskRun.resultJson.skipReason when conditions are not met at run start. */
export const workflowTaskSkipReason = {
  conditionNotMet: 'conditionNotMet',
} as const;

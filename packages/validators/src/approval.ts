import { z } from "zod";

// ---------------------------------------------------------------------------
// Prisma enum mirrors (string unions — validators package has no Prisma dep)
// ---------------------------------------------------------------------------

export const approvalStatusEnum = z.enum([
  "NOT_STARTED",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

export const approvalDecisionTypeEnum = z.enum([
  "APPROVE",
  "REJECT",
  "REQUEST_CHANGES",
  "DELEGATE",
]);

export const approvalResourceTypeEnum = z.enum([
  "INVOICE",
  "DOCUMENT",
  "CONTRACT",
]);

// ---------------------------------------------------------------------------
// Condition and step config schemas
// ---------------------------------------------------------------------------

export const conditionSchema = z.object({
  field: z.enum(["amount", "contractorType"]),
  operator: z.enum(["gt", "lt", "eq"]),
  value: z.union([z.number(), z.string()]),
});

export const stepConfigSchema = z.object({
  name: z.string().min(1).max(100),
  approverUserId: z.string().nullish(),
  approverRole: z
    .enum([
      "ORG_ADMIN",
      "FINANCE_ADMIN",
      "OPS_MANAGER",
      "TEAM_MANAGER",
      "LEGAL_VIEWER",
      "IT_ADMIN",
      "ACCOUNTANT",
      "READ_ONLY",
    ])
    .nullish(),
  slaHours: z.number().int().min(1).max(720),
  required: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Chain CRUD schemas
// ---------------------------------------------------------------------------

export const approvalChainCreateSchema = z.object({
  name: z.string().min(1).max(100),
  isDefault: z.boolean().default(false),
  conditionsJson: z.array(conditionSchema).nullish(),
  stepsJson: z.array(stepConfigSchema).min(1).max(3),
});

export type ApprovalChainCreate = z.infer<typeof approvalChainCreateSchema>;

export const approvalChainUpdateSchema = approvalChainCreateSchema.extend({
  id: z.string(),
  isActive: z.boolean().optional(),
});

export type ApprovalChainUpdate = z.infer<typeof approvalChainUpdateSchema>;

// ---------------------------------------------------------------------------
// Queue query schema
// ---------------------------------------------------------------------------

export const approvalQueueSchema = z.object({
  tab: z.enum(["my", "all"]).default("my"),
  status: z
    .enum(["all", "pending", "overdue", "approved", "rejected"])
    .default("all"),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(50).default(10),
  sortBy: z
    .enum(["slaDeadline", "submitted", "amount"])
    .default("slaDeadline"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export type ApprovalQueue = z.infer<typeof approvalQueueSchema>;

// ---------------------------------------------------------------------------
// Action schemas
// ---------------------------------------------------------------------------

export const approveStepSchema = z.object({
  stepId: z.string(),
  comment: z.string().optional(),
});

export const rejectStepSchema = z.object({
  stepId: z.string(),
  comment: z.string().min(10),
});

export const delegateStepSchema = z.object({
  stepId: z.string(),
  delegateToUserId: z.string(),
  comment: z.string().optional(),
});

export const requestClarificationSchema = z.object({
  stepId: z.string(),
  comment: z.string().min(1),
});

export const bulkApproveSchema = z.object({
  stepIds: z.array(z.string()).min(1).max(50),
});

export const bulkRejectSchema = z.object({
  stepIds: z.array(z.string()).min(1).max(50),
  comment: z.string().min(10),
});

import { z } from "zod";

// ---------------------------------------------------------------------------
// Prisma enum mirrors (string unions)
// ---------------------------------------------------------------------------

export const entityTypeEnum = z.enum([
  "ORGANIZATION",
  "CONTRACTOR",
  "CONTRACT",
  "DOCUMENT",
  "INVOICE",
  "WORKFLOW_RUN",
  "WORKFLOW_TASK_RUN",
  "PAYMENT_RUN",
  "PROJECT",
  "TEAM",
  "APPROVAL_FLOW",
]);

export const reminderTriggerTypeEnum = z.enum([
  "BEFORE_DUE_DATE",
  "ON_DUE_DATE",
  "AFTER_DUE_DATE",
  "BEFORE_CONTRACT_END",
  "BEFORE_DOCUMENT_EXPIRY",
  "ON_LIFECYCLE_CHANGE",
]);

export const notificationChannelEnum = z.enum(["IN_APP", "EMAIL", "SLACK"]);

export const recipientModeEnum = z.enum([
  "ENTITY_OWNER",
  "FINANCE_TEAM",
  "ASSIGNEE",
  "SPECIFIC_USER",
  "ROLE",
]);

// ---------------------------------------------------------------------------
// Reminder rule CRUD schemas
// ---------------------------------------------------------------------------

export const reminderRuleCreateSchema = z.object({
  name: z.string().min(1).max(100),
  entityType: entityTypeEnum,
  triggerType: reminderTriggerTypeEnum,
  offsetDays: z.number().int().min(1).max(365).optional(),
  offsetHours: z.number().int().min(1).max(720).optional(),
  channel: notificationChannelEnum,
  recipientMode: recipientModeEnum,
  configJson: z.record(z.unknown()).optional(),
  active: z.boolean().default(true),
});

export type ReminderRuleCreateInput = z.infer<typeof reminderRuleCreateSchema>;

export const reminderRuleUpdateSchema = reminderRuleCreateSchema.partial();

export type ReminderRuleUpdateInput = z.infer<typeof reminderRuleUpdateSchema>;

export const reminderRuleToggleSchema = z.object({
  id: z.string(),
  active: z.boolean(),
});

export type ReminderRuleToggleInput = z.infer<typeof reminderRuleToggleSchema>;

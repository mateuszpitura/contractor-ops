import { z } from "zod";

// ---------------------------------------------------------------------------
// Notification type constants
// ---------------------------------------------------------------------------

export const NOTIFICATION_TYPES = [
  "APPROVAL_REQUEST",
  "APPROVAL_DECISION",
  "TASK_ASSIGNED",
  "TASK_OVERDUE",
  "CONTRACT_EXPIRING",
  "INVOICE_RECEIVED",
  "KSEF_SYNC_COMPLETE",
] as const;

export const notificationTypeEnum = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof notificationTypeEnum>;

// ---------------------------------------------------------------------------
// Notification status enum (mirrors Prisma NotificationStatus)
// ---------------------------------------------------------------------------

export const notificationStatusEnum = z.enum([
  "PENDING",
  "SENT",
  "FAILED",
  "READ",
]);

// ---------------------------------------------------------------------------
// Notification list query schema
// ---------------------------------------------------------------------------

export const notificationListSchema = z.object({
  type: notificationTypeEnum.optional(),
  status: notificationStatusEnum.optional(),
  unreadOnly: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(50).default(10),
});

export type NotificationListInput = z.infer<typeof notificationListSchema>;

// ---------------------------------------------------------------------------
// Notification mark-read schema
// ---------------------------------------------------------------------------

export const notificationMarkReadSchema = z.object({
  notificationId: z.string(),
});

export type NotificationMarkReadInput = z.infer<
  typeof notificationMarkReadSchema
>;

// ---------------------------------------------------------------------------
// Notification preference update schema
// ---------------------------------------------------------------------------

export const notificationPreferenceUpdateSchema = z.object({
  preferences: z.array(
    z.object({
      notificationType: z.string(),
      channelEmail: z.boolean(),
      channelSlack: z.boolean(),
    }),
  ),
});

export type NotificationPreferenceUpdateInput = z.infer<
  typeof notificationPreferenceUpdateSchema
>;

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Notification type constants
// ---------------------------------------------------------------------------

export const NOTIFICATION_TYPES = [
  'APPROVAL_REQUEST',
  'APPROVAL_DECISION',
  'TASK_ASSIGNED',
  'TASK_OVERDUE',
  'CONTRACT_EXPIRING',
  'INVOICE_RECEIVED',
  'KSEF_SYNC_COMPLETE',
  'TRIAL_ENDING',
  'PAYMENT_FAILED',
  'PAYMENT_ACTION_REQUIRED',
  'CREDIT_EXHAUSTED',
  'SUBSCRIPTION_CHANGED',
  'DIRECTORY_NEW_HIRE',
  'DIRECTORY_DEPARTURE',
  'EQUIPMENT_RETURN_APPROVED',
  'EQUIPMENT_RETURN_REJECTED',
  'EQUIPMENT_RETURN_REQUESTED',
  'SHIPMENT_STATUS_CHANGE',
  // Phase 60 uses dot-notation per CONTEXT.md D-05; existing SCREAMING_SNAKE_CASE types remain unchanged.
  'classification.economic_dependency_warning',
  'classification.economic_dependency_critical',
  // Phase 60 CLASS-08 — reassessment trigger (material change detected on GB engagement with prior IR35 SDS)
  'classification.reassessment_trigger',
  // Phase 60 CLASS-09 — DRV § 7a SGB IV clearance expiry reminders (90/30/7 days before validTo)
  'classification.drv_expiry_90d',
  'classification.drv_expiry_30d',
  'classification.drv_expiry_7d',
  // Phase 72 COMPL-03 — per-recipient daily compliance-expiry digest (band cascade 90/60/30/15/7)
  'compliance.expiry_digest',
] as const;

export const notificationTypeEnum = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof notificationTypeEnum>;

// ---------------------------------------------------------------------------
// Notification status enum (mirrors Prisma NotificationStatus)
// ---------------------------------------------------------------------------

export const notificationStatusEnum = z.enum(['PENDING', 'SENT', 'FAILED', 'READ']);

// ---------------------------------------------------------------------------
// Notification list query schema
// ---------------------------------------------------------------------------

export const notificationListSchema = z.object({
  type: notificationTypeEnum.optional(),
  status: notificationStatusEnum.optional(),
  unreadOnly: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
});

export type NotificationListInput = z.infer<typeof notificationListSchema>;

// ---------------------------------------------------------------------------
// Notification mark-read schema
// ---------------------------------------------------------------------------

export const notificationMarkReadSchema = z.object({
  notificationId: z.string().min(1),
});

export type NotificationMarkReadInput = z.infer<typeof notificationMarkReadSchema>;

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

export type NotificationPreferenceUpdateInput = z.infer<typeof notificationPreferenceUpdateSchema>;

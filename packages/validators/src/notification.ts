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
  // Dot-notation types; existing SCREAMING_SNAKE_CASE types remain unchanged.
  'classification.economic_dependency_warning',
  'classification.economic_dependency_critical',
  // Reassessment trigger (material change detected on GB engagement with prior IR35 SDS)
  'classification.reassessment_trigger',
  // DRV § 7a SGB IV clearance expiry reminders (90/30/7 days before validTo)
  'classification.drv_expiry_90d',
  'classification.drv_expiry_30d',
  'classification.drv_expiry_7d',
  // Per-recipient daily compliance-expiry digest (band cascade 90/60/30/15/7)
  'compliance.expiry_digest',
  // Admin review of a contractor portal upload-replacement
  'compliance.upload.approved',
  'compliance.upload.rejected',
  // Informational 1099-K threshold heads-up (never a filing) — proactive when a
  // contractor's tax-year USD payouts near or cross the $20,000 + 200 threshold
  'tax.form_1099k_approaching',
  'tax.form_1099k_over',
  // Employee sick absence recorded (a direct notification to leave approvers /
  // HR, never an approval request — sick is reported, not routed for approval).
  'LEAVE_SICK_RECORDED',
  // Daily working-time scan: a worker's rolling weekly average crossed the
  // statutory 48h cap (per-recipient digest, one per day).
  'employee.wt_limit_breach',
  // Year-end 1099-NEC batch-due reminder (notify-only — never generates or files)
  'tax.form_1099_year_end_reminder',
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

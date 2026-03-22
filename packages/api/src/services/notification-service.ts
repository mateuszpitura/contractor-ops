import { prisma } from "@contractor-ops/db";
import type { NOTIFICATION_TYPES } from "@contractor-ops/validators";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationType = (typeof NOTIFICATION_TYPES)[number];

type EntityType =
  | "ORGANIZATION"
  | "CONTRACTOR"
  | "CONTRACT"
  | "DOCUMENT"
  | "INVOICE"
  | "WORKFLOW_RUN"
  | "WORKFLOW_TASK_RUN"
  | "PAYMENT_RUN"
  | "PROJECT"
  | "TEAM"
  | "APPROVAL_FLOW";

export interface NotificationEvent {
  organizationId: string;
  type: NotificationType;
  recipientUserIds: string[];
  title: string;
  body: string;
  entityType: EntityType;
  entityId: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Deduplication window (60 seconds)
// ---------------------------------------------------------------------------

const DEDUP_WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// Preference defaults
// ---------------------------------------------------------------------------

/**
 * Gets or creates notification preferences for a user + notification type.
 * If no preference row exists, creates one with all channels enabled.
 * Per plan: channelInApp is always true and not user-configurable.
 */
export async function getOrCreatePreferences(
  userId: string,
  organizationId: string,
  notificationType: string,
) {
  const existing = await prisma.userNotificationPreference.findFirst({
    where: {
      userId,
      notificationType,
    },
  });

  if (existing) {
    return existing;
  }

  const created = await prisma.userNotificationPreference.create({
    data: {
      userId,
      organizationId,
      notificationType,
      channelEmail: true,
      channelSlack: true,
      channelInApp: true,
      digestMode: false,
    },
  });

  return created;
}

// ---------------------------------------------------------------------------
// Placeholder external senders (Plan 02 implements actual sending)
// ---------------------------------------------------------------------------

async function sendNotificationEmail(
  _userId: string,
  _event: NotificationEvent,
): Promise<void> {
  // TODO: Plan 02 implements actual email sending via Resend
  console.log(
    `[notification-service] Email send placeholder for user=${_userId} type=${_event.type}`,
  );
}

async function sendSlackDM(
  _userId: string,
  _event: NotificationEvent,
): Promise<void> {
  // TODO: Plan 02 implements actual Slack DM sending via Slack API
  console.log(
    `[notification-service] Slack DM send placeholder for user=${_userId} type=${_event.type}`,
  );
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Central notification dispatcher.
 * For each recipient:
 * 1. Checks/creates preferences
 * 2. Deduplicates within 60s window (same user + type + entityId)
 * 3. Creates IN_APP notification (always)
 * 4. Calls email/Slack senders based on preferences (try/catch wrapped)
 *
 * External send failures never break the main operation.
 */
export async function dispatch(event: NotificationEvent): Promise<void> {
  const now = new Date();
  const dedupCutoff = new Date(now.getTime() - DEDUP_WINDOW_MS);

  for (const userId of event.recipientUserIds) {
    const prefs = await getOrCreatePreferences(
      userId,
      event.organizationId,
      event.type,
    );

    // Deduplication: skip if same notification was sent recently
    const duplicate = await prisma.notification.findFirst({
      where: {
        userId,
        type: event.type,
        entityId: event.entityId,
        createdAt: { gte: dedupCutoff },
      },
    });

    if (duplicate) {
      continue;
    }

    // IN_APP notification (always created — channelInApp is always true)
    if (prefs.channelInApp) {
      await prisma.notification.create({
        data: {
          organizationId: event.organizationId,
          userId,
          channel: "IN_APP",
          type: event.type,
          title: event.title,
          body: event.body,
          entityType: event.entityType,
          entityId: event.entityId,
          status: "SENT",
          sentAt: now,
        },
      });
    }

    // Email notification (preference-gated, try/catch wrapped)
    if (prefs.channelEmail) {
      try {
        await sendNotificationEmail(userId, event);
      } catch (error) {
        console.error(
          `[notification-service] Email send failed for user=${userId}:`,
          error,
        );
      }
    }

    // Slack notification (preference-gated, try/catch wrapped)
    if (prefs.channelSlack) {
      try {
        await sendSlackDM(userId, event);
      } catch (error) {
        console.error(
          `[notification-service] Slack DM send failed for user=${userId}:`,
          error,
        );
      }
    }
  }
}

import { prisma } from "@contractor-ops/db";
import type { NOTIFICATION_TYPES } from "@contractor-ops/validators";
import { Resend } from "resend";
import { renderNotificationEmail } from "./email-templates.js";
import { getConnectedMessagingProviders } from "./messaging/index.js";

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
  | "APPROVAL_FLOW"
  | "USER"
  | "RETURN_REQUEST"
  | "SHIPMENT";

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
// Resend client (lazy init)
// ---------------------------------------------------------------------------

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// ---------------------------------------------------------------------------
// Entity URL helper
// ---------------------------------------------------------------------------

const ENTITY_ROUTES: Record<string, string> = {
  INVOICE: "/invoices",
  CONTRACT: "/contracts",
  CONTRACTOR: "/contractors",
  WORKFLOW_RUN: "/workflows",
  WORKFLOW_TASK_RUN: "/workflows",
  APPROVAL_FLOW: "/approvals",
  DOCUMENT: "/documents",
};

function buildEntityUrl(entityType: string, entityId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const route = ENTITY_ROUTES[entityType] ?? "";
  return `${base}${route}/${entityId}`;
}

function buildPreferencesUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/settings?tab=notifications`;
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
      channelTeams: false,
      channelInApp: true,
      digestMode: false,
    },
  });

  return created;
}

// ---------------------------------------------------------------------------
// Real email sender (replaces placeholder)
// ---------------------------------------------------------------------------

/**
 * Sends a notification email via Resend with React Email templates.
 * Looks up user email, renders the template, and sends via Resend.
 */
async function sendNotificationEmail(userId: string, event: NotificationEvent): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user?.email) {
    console.warn(`[notification-service] No email for user=${userId}, skipping email`);
    return;
  }

  const ctaUrl = buildEntityUrl(event.entityType, event.entityId);
  const preferencesUrl = buildPreferencesUrl();

  const { subject, react } = renderNotificationEmail(event.type, {
    ...event.metadata,
    ctaUrl,
    preferencesUrl,
    title: event.title,
    body: event.body,
  });

  const resend = getResend();

  await resend.emails.send({
    from: "Contractor Ops <notifications@contractorhub.io>",
    to: user.email,
    subject,
    react,
    headers: {
      "List-Unsubscribe": `<${preferencesUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

// ---------------------------------------------------------------------------
// Channel alert category mapping
// ---------------------------------------------------------------------------

const NOTIFICATION_TYPE_TO_CHANNEL_CATEGORY: Partial<Record<NotificationType, string>> = {
  APPROVAL_REQUEST: "approvals",
  APPROVAL_DECISION: "approvals",
  INVOICE_RECEIVED: "invoices",
  CONTRACT_EXPIRING: "contracts",
  TASK_ASSIGNED: "tasks",
  TASK_OVERDUE: "tasks",
  EQUIPMENT_RETURN_REQUESTED: "equipment",
  EQUIPMENT_RETURN_APPROVED: "equipment",
  EQUIPMENT_RETURN_REJECTED: "equipment",
};

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
    const prefs = await getOrCreatePreferences(userId, event.organizationId, event.type);

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
        console.error(`[notification-service] Email send failed for user=${userId}:`, error);
      }
    }

    // Messaging provider dispatch (Slack, Teams, future platforms)
    const providers = await getConnectedMessagingProviders(event.organizationId);
    for (const provider of providers) {
      const prefKey = provider.platform === "slack" ? "channelSlack" : "channelTeams";
      if (!prefs[prefKey]) continue;

      try {
        const recipientId = await provider.getUserId(event.organizationId, userId);
        if (!recipientId) continue;

        if (event.type === "APPROVAL_REQUEST") {
          const meta = event.metadata ?? {};
          await provider.sendApprovalCard({
            organizationId: event.organizationId,
            recipientId,
            invoiceNumber: (meta.invoiceNumber as string) ?? "",
            contractorName: (meta.contractorName as string) ?? "",
            amount: String(meta.amount ?? ""),
            currency: (meta.currency as string) ?? "",
            dueDate: (meta.slaDeadline as string) ?? "",
            invoiceId: (meta.invoiceId as string) ?? "",
            flowId: (meta.flowId as string) ?? "",
          });
        } else {
          await provider.sendReminderDM({
            organizationId: event.organizationId,
            recipientId,
            text: `*${event.title}*\n${event.body}`,
          });
        }
      } catch (error) {
        console.error(
          `[notification-service] ${provider.platform} send failed for user=${userId}:`,
          error,
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Channel alert dispatch (org-level, not per-user)
  // ---------------------------------------------------------------------------
  const category = NOTIFICATION_TYPE_TO_CHANNEL_CATEGORY[event.type];
  if (category) {
    const channelProviders = await getConnectedMessagingProviders(event.organizationId);
    for (const provider of channelProviders) {
      try {
        const providerKey = provider.platform === "teams" ? "MICROSOFT_TEAMS" : "SLACK";
        const connection = await prisma.integrationConnection.findFirst({
          where: {
            organizationId: event.organizationId,
            provider: providerKey,
            status: "CONNECTED",
          },
          select: { configJson: true },
        });

        const config = (connection?.configJson as Record<string, unknown>) ?? {};
        const channelMapping = (config.channelMapping as Record<string, string>) ?? {};
        const channelId = channelMapping[category];

        if (!channelId) continue;

        await provider.sendChannelAlert({
          organizationId: event.organizationId,
          channelId,
          title: event.title,
          body: event.body,
          entityType: event.entityType ?? "unknown",
          entityId: event.entityId ?? "",
          details: [],
          viewUrl: buildEntityUrl(event.entityType ?? "unknown", event.entityId ?? ""),
        });
      } catch (error) {
        console.error(`[notification-service] ${provider.platform} channel alert failed:`, error);
      }
    }
  }
}

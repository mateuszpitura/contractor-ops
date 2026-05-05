import { prisma } from '@contractor-ops/db';
import { pLimit } from '@contractor-ops/integrations/services/concurrency';
import { createLogger } from '@contractor-ops/logger';
import type { NOTIFICATION_TYPES } from '@contractor-ops/validators';
import { getServerEnv } from '@contractor-ops/validators';
import { sendAppEmail } from './app-email.js';
import { renderNotificationEmail } from './email-templates.js';
import { getConnectedMessagingProviders } from './messaging/index.js';

const log = createLogger({ service: 'notification-service' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationType = (typeof NOTIFICATION_TYPES)[number];

type EntityType =
  | 'ORGANIZATION'
  | 'CONTRACTOR'
  | 'CONTRACT'
  | 'DOCUMENT'
  | 'INVOICE'
  | 'WORKFLOW_RUN'
  | 'WORKFLOW_TASK_RUN'
  | 'PAYMENT_RUN'
  | 'PROJECT'
  | 'TEAM'
  | 'APPROVAL_FLOW'
  | 'USER'
  | 'RETURN_REQUEST'
  | 'SHIPMENT';

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
// Entity URL helper
// ---------------------------------------------------------------------------

const ENTITY_ROUTES: Record<string, string> = {
  INVOICE: '/invoices',
  CONTRACT: '/contracts',
  CONTRACTOR: '/contractors',
  WORKFLOW_RUN: '/workflows',
  WORKFLOW_TASK_RUN: '/workflows',
  APPROVAL_FLOW: '/approvals',
  DOCUMENT: '/documents',
};

function buildEntityUrl(entityType: string, entityId: string): string {
  const base = getServerEnv().NEXT_PUBLIC_APP_URL;
  const route = ENTITY_ROUTES[entityType] ?? '';
  return `${base}${route}/${entityId}`;
}

function buildPreferencesUrl(): string {
  const base = getServerEnv().NEXT_PUBLIC_APP_URL;
  return `${base}/settings?tab=notifications`;
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------
//
// P2-A · F-ASYNC-04 — dedup is now enforced at the DB layer via the
// (organizationId, dedupKey) unique on Notification. The legacy
// `findFirst within 60s` lookup was racy under at-least-once delivery (two
// concurrent QStash retries both observed null and both inserted).
//
// `dedupKey` is computed per-recipient as
//   ${userId}:${type}:${entityId}:${dateBucketSeconds(60)}
// which preserves the previous "same notification within 60s" semantics
// while making the constraint atomic.

const DEDUP_BUCKET_SECONDS = 60;

function buildNotificationDedupKey(
  userId: string,
  type: string,
  entityId: string | null | undefined,
  now: Date,
): string {
  const bucket = Math.floor(now.getTime() / 1000 / DEDUP_BUCKET_SECONDS);
  return `${userId}:${type}:${entityId ?? ''}:${bucket}`;
}

// ---------------------------------------------------------------------------
// Preference defaults
// ---------------------------------------------------------------------------

/**
 * Gets or creates notification preferences for a (org, user, notification type).
 * If no preference row exists, creates one with all channels enabled.
 * Per plan: channelInApp is always true and not user-configurable.
 *
 * The where clause MUST include organizationId — without it, a user that
 * belongs to multiple orgs would have one org's preferences (e.g. email-off
 * for INVOICE_RECEIVED in Org A) silently applied in another org. The
 * matching schema-level unique key is (organizationId, userId, notificationType).
 */
export async function getOrCreatePreferences(
  userId: string,
  organizationId: string,
  notificationType: string,
) {
  const existing = await prisma.userNotificationPreference.findFirst({
    where: {
      organizationId,
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

  await sendAppEmail({
    from: 'Contractor Ops <notifications@contractorhub.io>',
    to: user.email,
    subject: String(subject),
    react,
    headers: {
      'List-Unsubscribe': `<${preferencesUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}

// ---------------------------------------------------------------------------
// Channel alert category mapping
// ---------------------------------------------------------------------------

const NOTIFICATION_TYPE_TO_CHANNEL_CATEGORY: Partial<Record<NotificationType, string>> = {
  APPROVAL_REQUEST: 'approvals',
  APPROVAL_DECISION: 'approvals',
  INVOICE_RECEIVED: 'invoices',
  CONTRACT_EXPIRING: 'contracts',
  TASK_ASSIGNED: 'tasks',
  TASK_OVERDUE: 'tasks',
  EQUIPMENT_RETURN_REQUESTED: 'equipment',
  EQUIPMENT_RETURN_APPROVED: 'equipment',
  EQUIPMENT_RETURN_REJECTED: 'equipment',
};

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Central notification dispatcher.
 * For each recipient:
 * 1. Checks/creates preferences
 * 2. Deduplicates via DB unique on (organizationId, dedupKey)
 * 3. Creates IN_APP notification (always)
 * 4. Calls email/Slack senders based on preferences (try/catch wrapped)
 *
 * External send failures never break the main operation.
 *
 * Producers should typically call this through the outbox layer
 * (`enqueueOutboxEvent({ tx, eventType: 'notification.dispatch', ... })`)
 * so the dispatch is durably scheduled iff the triggering tx commits.
 * Direct callers are tolerated for backwards compatibility.
 */
export async function dispatch(event: NotificationEvent): Promise<void> {
  const now = new Date();

  // F-ASYNC-09 / F-SCALE-05 / P2-B: bound the per-user fan-out at
  // FANOUT_CONCURRENCY (10) so a 100-recipient broadcast completes in ~10
  // RTTs instead of 100 while still protecting downstream providers
  // (Resend, Slack, Teams) from being saturated by a single dispatch.
  //
  // Replaces a previous `chunked + sequential await` shape with `p-limit`,
  // which lets every recipient slot start as soon as a previous one
  // finishes (the chunked version waited for the slowest call in each
  // batch before starting the next batch). For a 100-recipient broadcast
  // where one per-user dispatch is slow, throughput improves by avoiding
  // head-of-line blocking on each chunk boundary.
  const FANOUT_CONCURRENCY = 10;
  const limit = pLimit(FANOUT_CONCURRENCY);
  await Promise.all(
    event.recipientUserIds.map(userId => limit(() => dispatchToUser(userId, event, now))),
  );

  // Channel alert dispatch (org-level, not per-user)
  await dispatchChannelAlerts(event);
}

// ---------------------------------------------------------------------------
// Per-user dispatch
// ---------------------------------------------------------------------------

async function dispatchToUser(userId: string, event: NotificationEvent, now: Date): Promise<void> {
  const prefs = await getOrCreatePreferences(userId, event.organizationId, event.type);

  // F-ASYNC-04: dedup is enforced by the DB. We attempt the insert; on
  // unique-violation (P2002 on organizationId + dedupKey) we treat the
  // notification as already-delivered and skip the side channels too —
  // that's the correct semantic for retry: "another worker already did it".
  const dedupKey = buildNotificationDedupKey(userId, event.type, event.entityId, now);

  let inserted = true;
  if (prefs.channelInApp) {
    try {
      await prisma.notification.create({
        data: {
          organizationId: event.organizationId,
          userId,
          channel: 'IN_APP',
          type: event.type,
          title: event.title,
          body: event.body,
          entityType: event.entityType,
          entityId: event.entityId,
          status: 'SENT',
          sentAt: now,
          dedupKey,
        },
      });
    } catch (err) {
      // P2002 = unique constraint violation; surfaced by Prisma as
      // PrismaClientKnownRequestError. Other errors should still propagate
      // since they indicate real failures.
      if (isUniqueViolation(err)) {
        inserted = false;
        log.debug({ userId, type: event.type, entityId: event.entityId }, 'notification deduped');
      } else {
        throw err;
      }
    }
  }

  // If the IN_APP insert was deduped, skip side channels too — another
  // worker is responsible for them.
  if (!inserted) return;

  // Email notification (preference-gated)
  if (prefs.channelEmail) {
    try {
      await sendNotificationEmail(userId, event);
    } catch (_error) {
      /* fire-and-forget */
    }
  }

  // Messaging provider dispatch (Slack, Teams, future platforms)
  await dispatchToMessagingProviders(userId, event, prefs);
}

/**
 * Detects a Prisma unique-constraint violation (P2002) without taking a
 * direct dependency on the Prisma error class (which would force an extra
 * import chain into all callers of this module).
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  );
}

// ---------------------------------------------------------------------------
// Messaging provider dispatch (per-user DMs)
// ---------------------------------------------------------------------------

async function dispatchToMessagingProviders(
  userId: string,
  event: NotificationEvent,
  prefs: Awaited<ReturnType<typeof getOrCreatePreferences>>,
): Promise<void> {
  const providers = await getConnectedMessagingProviders(event.organizationId);

  for (const provider of providers) {
    const prefKey = provider.platform === 'slack' ? 'channelSlack' : 'channelTeams';
    if (!prefs[prefKey]) continue;

    try {
      const recipientId = await provider.getUserId(event.organizationId, userId);
      if (!recipientId) continue;

      await sendProviderMessage(provider, event, recipientId);
    } catch (_error) {
      /* fire-and-forget */
    }
  }
}

async function sendProviderMessage(
  provider: Awaited<ReturnType<typeof getConnectedMessagingProviders>>[number],
  event: NotificationEvent,
  recipientId: string,
): Promise<void> {
  if (event.type === 'APPROVAL_REQUEST') {
    const meta = event.metadata ?? {};
    await provider.sendApprovalCard({
      organizationId: event.organizationId,
      recipientId,
      invoiceNumber: (meta.invoiceNumber as string) ?? '',
      contractorName: (meta.contractorName as string) ?? '',
      amount: String(meta.amount ?? ''),
      currency: (meta.currency as string) ?? '',
      dueDate: (meta.slaDeadline as string) ?? '',
      invoiceId: (meta.invoiceId as string) ?? '',
      flowId: (meta.flowId as string) ?? '',
    });
  } else {
    await provider.sendReminderDM({
      organizationId: event.organizationId,
      recipientId,
      text: `*${event.title}*\n${event.body}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Channel alert dispatch (org-level, not per-user)
// ---------------------------------------------------------------------------

async function dispatchChannelAlerts(event: NotificationEvent): Promise<void> {
  const category = NOTIFICATION_TYPE_TO_CHANNEL_CATEGORY[event.type];
  if (!category) return;

  // S3-5 · F-ASYNC-14 — channel routing is org-derived: providers are
  // resolved from the event's organizationId and the channel mapping comes
  // from that org's IntegrationConnection.configJson. There is NO
  // user-default channel; a user's prefs in Org A can never resolve a
  // channel in Org B.
  const providers = await getConnectedMessagingProviders(event.organizationId);

  for (const provider of providers) {
    try {
      const channelId = await resolveChannelId(event.organizationId, provider.platform, category);
      if (!channelId) {
        // F-ASYNC-14: previously this was a silent `continue` — operators
        // had no signal that "approval went out as in-app + email but not
        // Slack" because the channel mapping for `approvals` was missing.
        // Log at debug so high-volume orgs without Slack mapping don't
        // flood, but at least the line is present in Axiom queries.
        log.debug(
          {
            organizationId: event.organizationId,
            platform: provider.platform,
            category,
            type: event.type,
          },
          'channel alert dropped: no channel mapping configured for category',
        );
        continue;
      }

      await provider.sendChannelAlert({
        organizationId: event.organizationId,
        channelId,
        title: event.title,
        body: event.body,
        entityType: event.entityType ?? 'unknown',
        entityId: event.entityId ?? '',
        details: [],
        viewUrl: buildEntityUrl(event.entityType ?? 'unknown', event.entityId ?? ''),
      });
    } catch (err) {
      log.error(
        { err, organizationId: event.organizationId, platform: provider.platform },
        'channel alert failed',
      );
    }
  }
}

/**
 * Resolves the channel id for a (org, platform, category) triple from the
 * org's connected messaging integration. Returns `null` if the org has not
 * mapped the category to a channel — caller logs and skips.
 *
 * S3-5 · F-ASYNC-14: every input is org-scoped:
 *   - `organizationId` is taken from the NotificationEvent (never from a
 *     user-default), so multi-org users cannot leak channel routing
 *     between tenants.
 *   - The `IntegrationConnection.findFirst` filter pins both
 *     `organizationId` and `status = CONNECTED`, so a provider connected
 *     in Org A is invisible to Org B even if the same user has access
 *     to both.
 *   - `channelMapping` lives inside the connection's `configJson`, which
 *     is itself org-scoped. There is no global / per-user fallback.
 */
async function resolveChannelId(
  organizationId: string,
  platform: string,
  category: string,
): Promise<string | null> {
  const providerKey = platform === 'teams' ? 'MICROSOFT_TEAMS' : 'SLACK';
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: providerKey,
      status: 'CONNECTED',
    },
    select: { configJson: true },
  });

  const config = (connection?.configJson as Record<string, unknown>) ?? {};
  const channelMapping = (config.channelMapping as Record<string, string>) ?? {};
  return channelMapping[category] ?? null;
}

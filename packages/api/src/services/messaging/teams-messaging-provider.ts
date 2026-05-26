// ---------------------------------------------------------------------------
// TeamsMessagingProvider
// ---------------------------------------------------------------------------
// Implements the MessagingProvider interface for Microsoft Teams.
// Uses Bot Framework's CloudAdapter for proactive messaging via stored
// ConversationReferences, and card builders from the teams/cards/ module.
// ---------------------------------------------------------------------------

import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { getServerEnv } from '@contractor-ops/validators';
// Migrated 2026-05-22 from archived `botbuilder` → Microsoft 365 Agents SDK.
// `ConfigurationBotFrameworkAuthentication(process.env)` is replaced by a
// plain `AuthConfiguration` object — we keep the existing `AZURE_BOT_APP_*`
// env vars instead of renaming to `clientId/clientSecret` so Render config
// stays unchanged. Multi-tenant is the default (no MicrosoftAppType field).
// `adapter.continueConversationAsync` was renamed to `continueConversation`
// in the Agents SDK.
import type { ConversationReference } from '@microsoft/agents-activity';
import type { AuthConfiguration, TurnContext } from '@microsoft/agents-hosting';
import { CardFactory, CloudAdapter, MessageFactory } from '@microsoft/agents-hosting';
import { buildActivityAlertCard } from '../teams/cards/activity-alert-card';
import { buildApprovalCard } from '../teams/cards/approval-card';
import { buildApprovalReminderCard } from '../teams/cards/approval-reminder-card';
import { getConversationReference } from '../teams/teams-bot-handler';
import type {
  ApprovalCardParams,
  ChannelAlertParams,
  MessagingProvider,
  ReminderDMParams,
} from './types';

const log = createLogger({ service: 'teams-messaging-provider' });

// ---------------------------------------------------------------------------
// CloudAdapter singleton
// ---------------------------------------------------------------------------

let adapterInstance: CloudAdapter | null = null;

function getCloudAdapter(): CloudAdapter {
  if (adapterInstance) return adapterInstance;

  const { AZURE_BOT_APP_ID, AZURE_BOT_APP_SECRET } = getServerEnv();
  const authConfig: AuthConfiguration = {
    clientId: AZURE_BOT_APP_ID ?? '',
    clientSecret: AZURE_BOT_APP_SECRET ?? '',
  };

  adapterInstance = new CloudAdapter(authConfig);
  return adapterInstance;
}

// ---------------------------------------------------------------------------
// User Resolution
// ---------------------------------------------------------------------------

/**
 * Looks up the ExternalLink for a given user to find their AAD Object ID.
 * Falls back to null if no link exists.
 */
async function resolveAadObjectId(organizationId: string, userId: string): Promise<string | null> {
  const link = await prisma.externalLink.findFirst({
    where: {
      organizationId,
      entityType: 'USER',
      entityId: userId,
      externalType: 'TEAMS_USER',
    },
    select: { externalId: true },
  });

  return link?.externalId ?? null;
}

// ---------------------------------------------------------------------------
// TeamsMessagingProvider
// ---------------------------------------------------------------------------

/**
 * Idempotency note (F-INT-04 / DRIFT-01).
 *
 * Microsoft Teams' Bot Framework `CloudAdapter.continueConversationAsync`
 * pathway does NOT expose a per-call idempotency interface — proactive
 * activities are fire-and-forget against a stored `ConversationReference`
 * with no client-supplied dedup token. We therefore do NOT invoke
 * `deriveIdempotencyKey` here. Deduplication of retried Teams sends is
 * enforced one layer up via `Notification.dedupKey` (Prisma): the outbox
 * dispatcher composes a stable `${outboxEventId}:${userId}` key on the
 * `Notification` row and skips the send when that row already exists.
 *
 * Rationale and audit trail: see
 * `.audit-2026-05-03/AUDIT-CLOSURE-2026-05-11.md` §6 ("What was NOT changed
 * (and why)") and the outbox handler comments in
 * `packages/api/src/services/outbox/handlers.ts`.
 */
export class TeamsMessagingProvider implements MessagingProvider {
  readonly platform = 'teams' as const;

  async getUserId(organizationId: string, userId: string): Promise<string | null> {
    return resolveAadObjectId(organizationId, userId);
  }

  async sendApprovalCard(params: ApprovalCardParams): Promise<void> {
    const convRef = await getConversationReference(params.organizationId, params.recipientId);
    if (!convRef) {
      log.warn({ recipientId: params.recipientId }, 'no ConversationReference for recipient');
      return;
    }

    const card = buildApprovalCard({
      invoiceNumber: params.invoiceNumber,
      contractorName: params.contractorName,
      amount: params.amount,
      currency: params.currency,
      dueDate: params.dueDate,
      invoiceId: params.invoiceId,
      flowId: params.flowId,
    });

    const adapter = getCloudAdapter();
    await adapter.continueConversation(
      getServerEnv().AZURE_BOT_APP_ID ?? '',
      convRef,
      async (context: TurnContext) => {
        // Agents SDK requires an `Activity` instance — MessageFactory.attachment
        // returns one populated with conversation-reference plumbing.
        await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(card)));
      },
    );
  }

  async sendReminderDM(params: ReminderDMParams): Promise<void> {
    const convRef = await getConversationReference(params.organizationId, params.recipientId);
    if (!convRef) {
      log.warn({ recipientId: params.recipientId }, 'no ConversationReference for recipient');
      return;
    }

    const adapter = getCloudAdapter();

    // If we have invoice data, send a rich reminder card
    if (params.invoiceId && params.flowId && params.invoiceNumber) {
      const card = buildApprovalReminderCard({
        overdueInDays: params.overdueInDays ?? 0,
        invoiceNumber: params.invoiceNumber,
        contractorName: params.contractorName ?? 'Unknown',
        amount: params.amount ?? '0.00',
        currency: params.currency ?? 'PLN',
        dueDate: params.dueDate ?? 'N/A',
        invoiceId: params.invoiceId,
        flowId: params.flowId,
      });

      await adapter.continueConversation(
        getServerEnv().AZURE_BOT_APP_ID ?? '',
        convRef,
        async (context: TurnContext) => {
          await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(card)));
        },
      );
      return;
    }

    // Simple text reminder. Agents SDK accepts string directly here —
    // it wraps in a Message activity internally.
    await adapter.continueConversation(
      getServerEnv().AZURE_BOT_APP_ID ?? '',
      convRef,
      async (context: TurnContext) => {
        await context.sendActivity(params.text);
      },
    );
  }

  async sendChannelAlert(params: ChannelAlertParams): Promise<void> {
    // Look up channel ConversationReference from the team conversation refs
    const connection = await prisma.integrationConnection.findFirst({
      where: {
        organizationId: params.organizationId,
        provider: 'MICROSOFT_TEAMS',
        status: 'CONNECTED',
      },
      select: { configJson: true },
    });

    if (!connection) {
      log.warn({ organizationId: params.organizationId }, 'no MICROSOFT_TEAMS connection for org');
      return;
    }

    const config = (connection.configJson as Record<string, unknown>) ?? {};
    const teamRefs = (config.teamConversationReferences as Record<string, unknown>) ?? {};
    const channelRef = teamRefs[params.channelId];

    if (!channelRef) {
      log.warn({ channelId: params.channelId }, 'no ConversationReference for channel');
      return;
    }

    const card = buildActivityAlertCard({
      title: params.title,
      details: params.details,
      viewUrl: params.viewUrl,
    });

    const adapter = getCloudAdapter();
    await adapter.continueConversation(
      getServerEnv().AZURE_BOT_APP_ID ?? '',
      channelRef as ConversationReference,
      async (context: TurnContext) => {
        await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(card)));
      },
    );
  }
}

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
import type { ConversationReference, TurnContext } from 'botbuilder';
import { CardFactory, CloudAdapter, ConfigurationBotFrameworkAuthentication } from 'botbuilder';
import { buildActivityAlertCard } from '../teams/cards/activity-alert-card.js';
import { buildApprovalCard } from '../teams/cards/approval-card.js';
import { buildApprovalReminderCard } from '../teams/cards/approval-reminder-card.js';
import { getConversationReference } from '../teams/teams-bot-handler.js';
import type {
  ApprovalCardParams,
  ChannelAlertParams,
  MessagingProvider,
  ReminderDMParams,
} from './types.js';

const log = createLogger({ service: 'teams-messaging-provider' });

// ---------------------------------------------------------------------------
// CloudAdapter singleton
// ---------------------------------------------------------------------------

let adapterInstance: CloudAdapter | null = null;

function getCloudAdapter(): CloudAdapter {
  if (adapterInstance) return adapterInstance;

  const { AZURE_BOT_APP_ID, AZURE_BOT_APP_SECRET } = getServerEnv();
  const auth = new ConfigurationBotFrameworkAuthentication({
    MicrosoftAppId: AZURE_BOT_APP_ID ?? '',
    MicrosoftAppPassword: AZURE_BOT_APP_SECRET ?? '',
    MicrosoftAppType: 'MultiTenant',
  });

  adapterInstance = new CloudAdapter(auth);
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
    await adapter.continueConversationAsync(
      getServerEnv().AZURE_BOT_APP_ID ?? '',
      convRef,
      async (context: TurnContext) => {
        await context.sendActivity({
          type: 'message',
          attachments: [CardFactory.adaptiveCard(card)],
        });
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

      await adapter.continueConversationAsync(
        getServerEnv().AZURE_BOT_APP_ID ?? '',
        convRef,
        async (context: TurnContext) => {
          await context.sendActivity({
            type: 'message',
            attachments: [CardFactory.adaptiveCard(card)],
          });
        },
      );
      return;
    }

    // Simple text reminder
    await adapter.continueConversationAsync(
      getServerEnv().AZURE_BOT_APP_ID ?? '',
      convRef,
      async (context: TurnContext) => {
        await context.sendActivity({ type: 'message', text: params.text });
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
    await adapter.continueConversationAsync(
      getServerEnv().AZURE_BOT_APP_ID ?? '',
      channelRef as ConversationReference,
      async (context: TurnContext) => {
        await context.sendActivity({
          type: 'message',
          attachments: [CardFactory.adaptiveCard(card)],
        });
      },
    );
  }
}

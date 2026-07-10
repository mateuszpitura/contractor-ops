// ConversationReference storage for proactive Teams messaging.
//
// Lives outside `teams-bot-handler.ts` so the messaging provider can read
// stored references without importing the bot handler (which imports the
// approval action layer — an import cycle otherwise).

import type { Prisma } from '@contractor-ops/db';
import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import type { ConversationReference } from '@microsoft/agents-activity';

const log = createLogger({ service: 'teams-conversation-reference' });

export interface TeamsConnectionConfig {
  conversationReferences?: Record<string, ConversationReference>;
  teamConversationReferences?: Record<string, ConversationReference>;
  channelMapping?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Stores a ConversationReference for proactive messaging.
 * Personal refs are keyed by the user's AAD Object ID.
 * Channel refs are keyed by conversation.id (channel thread ID,
 * e.g. "19:xxx@thread.tacv2") within the MICROSOFT_TEAMS
 * IntegrationConnection configJson.
 */
export async function storeConversationReference(
  organizationId: string,
  ref: Partial<ConversationReference>,
): Promise<void> {
  const aadObjectId = ref.user?.aadObjectId;
  if (!aadObjectId) {
    log.warn({}, 'cannot store ConversationReference: no aadObjectId');
    return;
  }

  const connection = await prisma.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: 'MICROSOFT_TEAMS',
      status: 'CONNECTED',
    },
    select: { id: true, configJson: true },
  });

  if (!connection) {
    log.warn({ organizationId }, 'no MICROSOFT_TEAMS connection for org');
    return;
  }

  const config = (connection.configJson as TeamsConnectionConfig) ?? {};
  const conversationReferences = config.conversationReferences ?? {};

  conversationReferences[aadObjectId] = ref as ConversationReference;

  // For channel-scoped conversations, store under teamConversationReferences
  // keyed by conversation.id (channel thread ID like "19:xxx@thread.tacv2")
  // so sendChannelAlert can look up by params.channelId
  const teamConversationReferences = config.teamConversationReferences ?? {};
  const channelId = ref.conversation?.id;
  if (channelId && ref.conversation?.conversationType === 'channel') {
    teamConversationReferences[channelId] = ref as ConversationReference;
  }

  await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: {
      configJson: {
        ...config,
        conversationReferences,
        teamConversationReferences,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Retrieves a stored ConversationReference for a user by AAD Object ID.
 */
export async function getConversationReference(
  organizationId: string,
  aadObjectId: string,
): Promise<ConversationReference | null> {
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: 'MICROSOFT_TEAMS',
      status: 'CONNECTED',
    },
    select: { configJson: true },
  });

  if (!connection) return null;

  const config = (connection.configJson as TeamsConnectionConfig) ?? {};
  return config.conversationReferences?.[aadObjectId] ?? null;
}

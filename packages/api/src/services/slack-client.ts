import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { prisma } from '@contractor-ops/db';
import { getCredentials } from '@contractor-ops/integrations/services/credential-service';
import { getServerEnv } from '@contractor-ops/validators';
import { WebClient } from '@slack/web-api';

// ---------------------------------------------------------------------------
// Token Encryption / Decryption (AES-256-GCM)
// Per D-09: NEVER store raw xoxb- tokens
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const _AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = getServerEnv().SLACK_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('SLACK_TOKEN_ENCRYPTION_KEY environment variable is not set');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypts a Slack bot token using AES-256-GCM.
 * Returns format: iv:authTag:ciphertext (all hex-encoded).
 */
export function encryptToken(token: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a Slack bot token encrypted with encryptToken().
 */
export function decryptToken(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivHex, authTagHex, ciphertext] = parts as [string, string, string];
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ---------------------------------------------------------------------------
// WebClient Factory
// ---------------------------------------------------------------------------

/**
 * Returns a Slack WebClient for the given organization, or null if no
 * active Slack integration is configured.
 */
export async function getSlackClient(organizationId: string): Promise<WebClient | null> {
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: 'SLACK',
      status: 'CONNECTED',
    },
  });

  if (!connection) {
    return null;
  }

  const blob = await getCredentials(connection.credentialsRef, 'slack');
  const token = decryptToken(blob.accessToken);
  return new WebClient(token);
}

// ---------------------------------------------------------------------------
// User ID Mapping
// ---------------------------------------------------------------------------

/**
 * Looks up the Slack user ID for a given internal user within an organization.
 * Returns null if no mapping exists (user not synced with Slack).
 */
export async function getSlackUserIdForUser(
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const link = await prisma.externalLink.findFirst({
    where: {
      organizationId,
      entityType: 'CONTRACTOR', // ExternalLink uses EntityType enum; USER is not in enum
      entityId: userId,
      externalType: 'SLACK_USER',
    },
  });

  // Also check via integration connection for organization-level links
  if (!link) {
    // Query across all integration connections for this org
    const altLink = await prisma.externalLink.findFirst({
      where: {
        organizationId,
        entityId: userId,
        externalType: 'SLACK_USER',
      },
    });
    return altLink?.externalId ?? null;
  }

  return link.externalId;
}

// ---------------------------------------------------------------------------
// Approval Card (Block Kit)
// ---------------------------------------------------------------------------

interface ApprovalCardParams {
  organizationId: string;
  slackUserId: string;
  invoiceNumber: string;
  contractorName: string;
  amount: string;
  currency: string;
  slaDeadline: string;
  invoiceId: string;
  flowId: string;
}

/**
 * Sends an approval request card as a Slack DM with approve/reject buttons.
 * Uses Block Kit for rich formatting per research Pattern 2.
 */
export async function sendApprovalCard(params: ApprovalCardParams) {
  const client = await getSlackClient(params.organizationId);
  if (!client) {
    throw new Error(`No Slack integration for organization ${params.organizationId}`);
  }

  const actionValue = JSON.stringify({
    invoiceId: params.invoiceId,
    flowId: params.flowId,
  });

  const blocks = [
    {
      type: 'header' as const,
      text: {
        type: 'plain_text' as const,
        text: 'Invoice Approval Request',
        emoji: true,
      },
    },
    {
      type: 'section' as const,
      fields: [
        {
          type: 'mrkdwn' as const,
          text: `*Invoice:*\n${params.invoiceNumber}`,
        },
        {
          type: 'mrkdwn' as const,
          text: `*Contractor:*\n${params.contractorName}`,
        },
        {
          type: 'mrkdwn' as const,
          text: `*Amount:*\n${params.amount} ${params.currency}`,
        },
        {
          type: 'mrkdwn' as const,
          text: `*SLA Deadline:*\n${params.slaDeadline}`,
        },
      ],
    },
    {
      type: 'actions' as const,
      elements: [
        {
          type: 'button' as const,
          text: {
            type: 'plain_text' as const,
            text: 'Approve',
            emoji: true,
          },
          style: 'primary' as const,
          action_id: 'approve_invoice',
          value: actionValue,
        },
        {
          type: 'button' as const,
          text: {
            type: 'plain_text' as const,
            text: 'Reject',
            emoji: true,
          },
          style: 'danger' as const,
          action_id: 'reject_invoice',
          value: actionValue,
        },
      ],
    },
  ];

  const fallbackText = `Invoice Approval: ${params.invoiceNumber} from ${params.contractorName} - ${params.amount} ${params.currency}`;

  return client.chat.postMessage({
    channel: params.slackUserId,
    text: fallbackText,
    blocks,
  });
}

// ---------------------------------------------------------------------------
// Update Message to Result
// ---------------------------------------------------------------------------

interface UpdateMessageParams {
  organizationId: string;
  channel: string;
  ts: string;
  result: 'approved' | 'rejected';
  actorName: string;
  comment?: string;
}

/**
 * Updates the original approval message to show the decision result.
 * Uses chat.update (not response_url) per state of the art.
 */
export async function updateMessageToResult(params: UpdateMessageParams) {
  const client = await getSlackClient(params.organizationId);
  if (!client) {
    throw new Error(`No Slack integration for organization ${params.organizationId}`);
  }

  const icon = params.result === 'approved' ? 'white_check_mark' : 'x';
  const label = params.result === 'approved' ? 'Approved' : 'Rejected';
  const commentLine = params.comment ? `\n>_${params.comment}_` : '';

  const blocks = [
    {
      type: 'section' as const,
      text: {
        type: 'mrkdwn' as const,
        text: `:${icon}: *${label}* by ${params.actorName}${commentLine}`,
      },
    },
  ];

  return client.chat.update({
    channel: params.channel,
    ts: params.ts,
    blocks,
    text: `${label} by ${params.actorName}`,
  });
}

// ---------------------------------------------------------------------------
// Generic Reminder DM
// ---------------------------------------------------------------------------

interface ReminderDMParams {
  organizationId: string;
  slackUserId: string;
  text: string;
  blocks?: Record<string, unknown>[];
}

/**
 * Sends a generic DM to a Slack user for reminder notifications.
 */
export async function sendReminderDM(params: ReminderDMParams) {
  const client = await getSlackClient(params.organizationId);
  if (!client) {
    return null;
  }

  return client.chat.postMessage({
    channel: params.slackUserId,
    text: params.text,
    blocks: params.blocks as never,
  });
}

// ---------------------------------------------------------------------------
// Workspace User Sync (D-10)
// ---------------------------------------------------------------------------

/**
 * Syncs Slack workspace users with internal users by matching email addresses.
 * Requires users:read.email scope (pitfall 3).
 *
 * @returns Match statistics: { matched, total }
 */
export async function syncWorkspaceUsers(
  organizationId: string,
  integrationConnectionId: string,
): Promise<{ matched: number; total: number }> {
  const client = await getSlackClient(organizationId);
  if (!client) {
    return { matched: 0, total: 0 };
  }

  const result = await client.users.list({});
  const members = result.members ?? [];
  const realMembers = members.filter(m => !(m.is_bot || m.deleted) && m.id !== 'USLACKBOT');

  let matched = 0;

  for (const member of realMembers) {
    const email = member.profile?.email;
    if (!email) continue;

    // Find internal user by email
    const user = await prisma.user.findFirst({
      where: {
        email,
        members: {
          some: { organizationId },
        },
      },
      select: { id: true },
    });

    if (!user) continue;

    // Upsert ExternalLink for this user <-> Slack user mapping
    const existing = await prisma.externalLink.findFirst({
      where: {
        organizationId,
        integrationConnectionId,
        entityId: user.id,
        externalType: 'SLACK_USER',
      },
    });

    if (!existing) {
      await prisma.externalLink.create({
        data: {
          organizationId,
          integrationConnectionId,
          entityType: 'ORGANIZATION',
          entityId: user.id,
          externalType: 'SLACK_USER',
          externalId: member.id!,
          metadataJson: {
            displayName: member.profile?.display_name ?? member.real_name ?? null,
          },
        },
      });
    }

    matched++;
  }

  return { matched, total: realMembers.length };
}

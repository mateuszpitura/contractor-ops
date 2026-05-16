import {
  getSlackClient,
  getSlackUserIdForUser,
  sendApprovalCard as slackSendApprovalCard,
  sendReminderDM as slackSendReminderDM,
} from '../slack-client';
import type {
  ApprovalCardParams,
  ChannelAlertParams,
  MessagingProvider,
  ReminderDMParams,
} from './types';

// ---------------------------------------------------------------------------
// SlackMessagingProvider
// ---------------------------------------------------------------------------
// Adapts the existing slack-client.ts functions to the MessagingProvider
// interface. No new Slack logic is introduced — this is a thin delegation
// layer that enables notification-service.ts to treat Slack like any other
// messaging platform.
// ---------------------------------------------------------------------------

/**
 * Idempotency note (F-INT-04 / DRIFT-01).
 *
 * Slack's Web API (chat.postMessage and related) does NOT expose a per-call
 * idempotency interface — there is no `Idempotency-Key` header and no
 * client-supplied dedup token. We therefore do NOT invoke
 * `deriveIdempotencyKey` here. Deduplication of retried Slack sends is
 * enforced one layer up via `Notification.dedupKey` (Prisma): the outbox
 * dispatcher composes a stable `${outboxEventId}:${userId}` key on the
 * `Notification` row and skips the send when that row already exists.
 *
 * Rationale and audit trail: see
 * `.audit-2026-05-03/AUDIT-CLOSURE-2026-05-11.md` §6 ("What was NOT changed
 * (and why)") and the outbox handler comments in
 * `packages/api/src/services/outbox/handlers.ts`.
 */
export class SlackMessagingProvider implements MessagingProvider {
  readonly platform = 'slack' as const;

  async getUserId(organizationId: string, userId: string): Promise<string | null> {
    return getSlackUserIdForUser(organizationId, userId);
  }

  async sendApprovalCard(params: ApprovalCardParams): Promise<void> {
    await slackSendApprovalCard({
      organizationId: params.organizationId,
      slackUserId: params.recipientId,
      invoiceNumber: params.invoiceNumber,
      contractorName: params.contractorName,
      amount: params.amount,
      currency: params.currency,
      slaDeadline: params.dueDate,
      invoiceId: params.invoiceId,
      flowId: params.flowId,
    });
  }

  async sendReminderDM(params: ReminderDMParams): Promise<void> {
    await slackSendReminderDM({
      organizationId: params.organizationId,
      slackUserId: params.recipientId,
      text: params.text,
    });
  }

  async sendChannelAlert(params: ChannelAlertParams): Promise<void> {
    const client = await getSlackClient(params.organizationId);
    if (!client) {
      throw new Error(`No Slack integration for organization ${params.organizationId}`);
    }

    const detailLines = params.details.map(d => `*${d.label}:* ${d.value}`).join('\n');

    const text = [
      `*${params.title}*`,
      params.body,
      '',
      detailLines,
      '',
      `<${params.viewUrl}|View in Contractor Ops>`,
    ].join('\n');

    await client.chat.postMessage({
      channel: params.channelId,
      text,
      mrkdwn: true,
    });
  }
}

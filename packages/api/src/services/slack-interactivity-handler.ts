/**
 * Slack interactivity processing (block_actions approve/reject, view_submission).
 * Wired from apps/api webhook _process route (Jira/Linear pattern).
 */
import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { z } from 'zod';
import {
  executeIntegrationApprovalApprove,
  executeIntegrationApprovalReject,
  IntegrationApprovalError,
} from './approval-integration-action';
import { getSlackClient, updateMessageToResult } from './slack-client';

const log = createLogger({ service: 'slack-interactivity' });

const actionValueSchema = z.object({
  invoiceId: z.string().min(1),
  flowId: z.string().min(1),
});

const rejectModalMetadataSchema = z.object({
  invoiceId: z.string().min(1),
  flowId: z.string().min(1),
  channel: z.string().min(1),
  messageTs: z.string().min(1),
});

async function resolveSlackActorUserId(
  organizationId: string,
  slackUserId: string,
): Promise<{ userId: string; userName: string } | null> {
  const link = await prisma.externalLink.findFirst({
    where: {
      organizationId,
      externalType: 'SLACK_USER',
      externalId: slackUserId,
    },
    select: { entityId: true },
  });
  if (!link) return null;

  const user = await prisma.user.findUnique({
    where: { id: link.entityId },
    select: { id: true, name: true },
  });
  if (!user) return null;
  return { userId: user.id, userName: user.name ?? 'Unknown' };
}

function buildRejectModalView(metadata: z.infer<typeof rejectModalMetadataSchema>) {
  return {
    type: 'modal' as const,
    callback_id: 'reject_invoice_modal',
    private_metadata: JSON.stringify(metadata),
    title: { type: 'plain_text' as const, text: 'Reject Invoice' },
    submit: { type: 'plain_text' as const, text: 'Reject' },
    close: { type: 'plain_text' as const, text: 'Cancel' },
    blocks: [
      {
        type: 'input' as const,
        block_id: 'comment_block',
        label: { type: 'plain_text' as const, text: 'Rejection reason (required)' },
        element: {
          type: 'plain_text_input' as const,
          action_id: 'comment_input',
          multiline: true,
          min_length: 10,
        },
      },
    ],
  };
}

/**
 * Synchronous handler for reject_invoice block_actions — must open the modal
 * within Slack's 3-second interactivity window (called from ingress, not QStash).
 */
export async function openSlackRejectModal(
  organizationId: string,
  payload: {
    trigger_id: string;
    user: { id: string };
    channel: { id: string };
    message: { ts: string };
    actions: Array<{ action_id: string; value?: string }>;
  },
): Promise<void> {
  const action = payload.actions.find(a => a.action_id === 'reject_invoice');
  if (!action?.value) return;

  const parsed = actionValueSchema.safeParse(JSON.parse(action.value));
  if (!parsed.success) return;

  const client = await getSlackClient(organizationId);
  if (!client) return;

  await client.views.open({
    trigger_id: payload.trigger_id,
    view: buildRejectModalView({
      invoiceId: parsed.data.invoiceId,
      flowId: parsed.data.flowId,
      channel: payload.channel.id,
      messageTs: payload.message.ts,
    }),
  });
}

async function handleApproveAction(
  organizationId: string,
  slackUserId: string,
  channelId: string,
  messageTs: string,
  flowId: string,
): Promise<void> {
  const actor = await resolveSlackActorUserId(organizationId, slackUserId);
  if (!actor) {
    log.warn({ organizationId, slackUserId }, 'slack user not linked');
    return;
  }

  try {
    await executeIntegrationApprovalApprove(prisma, {
      organizationId,
      flowId,
      actorUserId: actor.userId,
      actorName: actor.userName,
    });

    await updateMessageToResult({
      organizationId,
      channel: channelId,
      ts: messageTs,
      result: 'approved',
      actorName: actor.userName,
    });
  } catch (error) {
    if (error instanceof IntegrationApprovalError) {
      log.warn({ err: error, flowId, code: error.code }, 'slack approve failed');
      return;
    }
    throw error;
  }
}

async function handleViewSubmission(
  organizationId: string,
  payload: {
    user: { id: string };
    view: {
      private_metadata: string;
      state: { values: Record<string, Record<string, { value?: string }>> };
    };
  },
): Promise<void> {
  const meta = rejectModalMetadataSchema.safeParse(JSON.parse(payload.view.private_metadata));
  if (!meta.success) return;

  const comment = payload.view.state.values.comment_block?.comment_input?.value?.trim() ?? '';
  if (comment.length < 10) return;

  const actor = await resolveSlackActorUserId(organizationId, payload.user.id);
  if (!actor) return;

  try {
    await executeIntegrationApprovalReject(prisma, {
      organizationId,
      flowId: meta.data.flowId,
      actorUserId: actor.userId,
      actorName: actor.userName,
      comment,
    });

    await updateMessageToResult({
      organizationId,
      channel: meta.data.channel,
      ts: meta.data.messageTs,
      result: 'rejected',
      actorName: actor.userName,
      comment,
    });
  } catch (error) {
    if (error instanceof IntegrationApprovalError) {
      log.warn({ err: error, flowId: meta.data.flowId }, 'slack reject failed');
      return;
    }
    throw error;
  }
}

/**
 * Async Slack interactivity processor (QStash drain).
 */
export async function processSlackInteractivity(
  organizationId: string,
  payloadJson: unknown,
): Promise<void> {
  const payload = payloadJson as Record<string, unknown>;
  const type = payload.type as string | undefined;

  if (type === 'block_actions') {
    const user = payload.user as { id: string } | undefined;
    const channel = payload.channel as { id: string } | undefined;
    const message = payload.message as { ts: string } | undefined;
    const actions = payload.actions as Array<{ action_id: string; value?: string }> | undefined;

    if (!(user?.id && channel?.id && message?.ts && actions?.length)) return;

    const approveAction = actions.find(a => a.action_id === 'approve_invoice');
    if (!approveAction?.value) return;

    const parsed = actionValueSchema.safeParse(JSON.parse(approveAction.value));
    if (!parsed.success) return;

    await handleApproveAction(organizationId, user.id, channel.id, message.ts, parsed.data.flowId);
    return;
  }

  if (type === 'view_submission') {
    const view = payload.view as
      | {
          private_metadata: string;
          state: { values: Record<string, Record<string, { value?: string }>> };
        }
      | undefined;
    const user = payload.user as { id: string } | undefined;
    if (!(view && user?.id)) return;

    await handleViewSubmission(organizationId, { user, view });
  }
}

/**
 * Entry point for SlackAdapter.handleWebhook — delegates to the shared processor.
 */
export async function handleSlackAdapterWebhook(
  payload: unknown,
  organizationId: string,
  _connectionId: string,
): Promise<void> {
  await processSlackInteractivity(organizationId, payload);
}

/**
 * @deprecated Phase 12: Use /api/webhooks/slack instead.
 * This route remains for backward compatibility during Slack app URL migration.
 * Remove after Slack app webhook URL is updated to /api/webhooks/slack.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { advanceFlow } from '@contractor-ops/api/services/approval-engine';
import { getSlackClient, updateMessageToResult } from '@contractor-ops/api/services/slack-client';
import { prisma } from '@contractor-ops/db';
import { createWebhookLogger } from '@contractor-ops/logger';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const log = createWebhookLogger('slack-interactivity');

// ---------------------------------------------------------------------------
// Slack Signature Verification
// ---------------------------------------------------------------------------

function verifySlackSignature(body: string, timestamp: string, signature: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;

  // Check timestamp freshness (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = `v0=${createHmac('sha256', signingSecret).update(sigBasestring).digest('hex')}`;

  const myBuffer = Buffer.from(mySignature);
  const slackBuffer = Buffer.from(signature);

  if (myBuffer.length !== slackBuffer.length) return false;
  return timingSafeEqual(myBuffer, slackBuffer);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ActionValue {
  invoiceId: string;
  flowId: string;
}

/**
 * Slack interaction payload shape.
 * Covers block_actions and view_submission interaction types.
 * @see https://api.slack.com/reference/interaction-payloads
 */
interface SlackInteractionPayload {
  type: 'block_actions' | 'view_submission' | string;
  trigger_id?: string;
  user: { id: string; name: string };
  actions?: Array<{
    action_id: string;
    value?: string;
    selected_option?: { value: string };
  }>;
  view?: {
    callback_id: string;
    private_metadata: string;
    state: {
      values: Record<
        string,
        Record<string, { value?: string; selected_option?: { value: string } }>
      >;
    };
  };
  channel?: { id: string };
  message?: { ts: string };
}

/**
 * Resolves internal userId from a Slack user ID by looking up ExternalLink.
 */
async function resolveUserFromSlackId(
  slackUserId: string,
): Promise<{ userId: string; userName: string; organizationId: string } | null> {
  const link = await prisma.externalLink.findFirst({
    where: {
      externalType: 'SLACK_USER',
      externalId: slackUserId,
    },
  });

  if (!link) return null;

  const user = await prisma.user.findUnique({
    where: { id: link.entityId },
    select: { id: true, name: true },
  });

  if (!user) return null;

  return {
    userId: user.id,
    userName: user.name ?? 'Unknown',
    organizationId: link.organizationId,
  };
}

// ---------------------------------------------------------------------------
// Async processing (fire-and-forget)
// ---------------------------------------------------------------------------

async function processBlockAction(payload: SlackInteractionPayload) {
  const action = payload.actions?.[0];
  if (!action) return;

  const slackUserId = payload.user?.id as string;
  const actor = await resolveUserFromSlackId(slackUserId);
  if (!actor) {
    log.error({ slackUserId }, 'could not resolve user for slack id');
    return;
  }

  if (action.action_id === 'approve_invoice') {
    const value = JSON.parse(action.value) as ActionValue;

    // Advance approval flow via Prisma transaction
    await prisma.$transaction(async tx => {
      // Record the step decision
      const flow = await tx.approvalFlow.findUniqueOrThrow({
        where: { id: value.flowId },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });

      const currentStep = flow.steps.find(
        s => s.stepOrder === flow.currentStepOrder && s.status === 'PENDING',
      );

      if (currentStep) {
        await tx.approvalStep.update({
          where: { id: currentStep.id },
          data: {
            status: 'APPROVED',
            actedAt: new Date(),
            decision: 'APPROVE',
          },
        });

        // Record decision in ApprovalDecision table
        await tx.approvalDecision.create({
          data: {
            organizationId: actor.organizationId,
            approvalStepId: currentStep.id,
            actorUserId: actor.userId,
            decision: 'APPROVE',
          },
        });
      }

      // Advance the flow
      await advanceFlow(tx, value.flowId);
    });

    // Update the Slack message to show result
    await updateMessageToResult({
      organizationId: actor.organizationId,
      channel: payload.channel?.id ?? payload.user?.id,
      ts: payload.message?.ts,
      result: 'approved',
      actorName: actor.userName,
    });
  }

  if (action.action_id === 'reject_invoice') {
    const value = JSON.parse(action.value) as ActionValue;

    // Open rejection modal with comment field
    const client = await getSlackClient(actor.organizationId);
    if (!client) return;

    const privateMetadata = JSON.stringify({
      invoiceId: value.invoiceId,
      flowId: value.flowId,
      channel: payload.channel?.id ?? payload.user?.id,
      messageTs: payload.message?.ts,
    });

    await client.views.open({
      trigger_id: payload.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'reject_invoice_modal',
        title: {
          type: 'plain_text',
          text: 'Reject Invoice',
        },
        submit: {
          type: 'plain_text',
          text: 'Reject',
        },
        close: {
          type: 'plain_text',
          text: 'Cancel',
        },
        private_metadata: privateMetadata,
        blocks: [
          {
            type: 'input',
            block_id: 'comment_block',
            element: {
              type: 'plain_text_input',
              action_id: 'comment_input',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Reason for rejection (required)',
              },
            },
            label: {
              type: 'plain_text',
              text: 'Comment',
            },
          },
        ],
      },
    });
  }
}

async function processViewSubmission(payload: SlackInteractionPayload) {
  if (payload.view?.callback_id !== 'reject_invoice_modal') return;

  const comment = payload.view?.state?.values?.comment_block?.comment_input?.value ?? '';

  const metadata = JSON.parse(payload.view.private_metadata) as {
    invoiceId: string;
    flowId: string;
    channel: string;
    messageTs: string;
  };

  const slackUserId = payload.user?.id as string;
  const actor = await resolveUserFromSlackId(slackUserId);
  if (!actor) return;

  // Reject the approval flow
  await prisma.$transaction(async tx => {
    const flow = await tx.approvalFlow.findUniqueOrThrow({
      where: { id: metadata.flowId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    const currentStep = flow.steps.find(
      s => s.stepOrder === flow.currentStepOrder && s.status === 'PENDING',
    );

    if (currentStep) {
      await tx.approvalStep.update({
        where: { id: currentStep.id },
        data: {
          status: 'REJECTED',
          actedAt: new Date(),
          decision: 'REJECT',
          comment,
        },
      });

      // Record decision in ApprovalDecision table
      await tx.approvalDecision.create({
        data: {
          organizationId: actor.organizationId,
          approvalStepId: currentStep.id,
          actorUserId: actor.userId,
          decision: 'REJECT',
          comment,
        },
      });
    }

    // Mark flow as rejected
    await tx.approvalFlow.update({
      where: { id: metadata.flowId },
      data: {
        status: 'REJECTED',
        completedAt: new Date(),
      },
    });
  });

  // Update original Slack message
  await updateMessageToResult({
    organizationId: actor.organizationId,
    channel: metadata.channel,
    ts: metadata.messageTs,
    result: 'rejected',
    actorName: actor.userName,
    comment,
  });
}

// ---------------------------------------------------------------------------
// POST /api/slack/interactivity
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const timestamp = request.headers.get('x-slack-request-timestamp') ?? '';
  const signature = request.headers.get('x-slack-signature') ?? '';

  // Verify Slack request signature
  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Parse payload from form data
  const params = new URLSearchParams(rawBody);
  const payloadStr = params.get('payload');
  if (!payloadStr) {
    return NextResponse.json({ error: 'Missing payload' }, { status: 400 });
  }

  const payload = JSON.parse(payloadStr) as SlackInteractionPayload;

  // For view_submission, we must return synchronously with response_action
  if (payload.type === 'view_submission') {
    // Process async but return immediately
    processViewSubmission(payload).catch(error => {
      log.error({ err: error }, 'view_submission error');
    });

    // Return response_action: clear to close the modal
    return NextResponse.json({ response_action: 'clear' });
  }

  // For block_actions, respond immediately with 200 (3-second window per pitfall 1)
  // then process asynchronously
  if (payload.type === 'block_actions') {
    processBlockAction(payload).catch(error => {
      log.error({ err: error }, 'block_actions error');
    });
  }

  return new NextResponse(null, { status: 200 });
}

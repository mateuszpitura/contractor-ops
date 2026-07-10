// ---------------------------------------------------------------------------
// TeamsBotHandler
// ---------------------------------------------------------------------------
// Extends TeamsActivityHandler from Bot Framework to process:
// - Adaptive Card invoke actions (approve/reject invoices)
// - Task module fetch/submit (rejection modal with mandatory comment)
// - Conversation updates (store ConversationReference for proactive messaging)
//
// All invoke payloads are validated with Zod before processing.
// ---------------------------------------------------------------------------

import type { Prisma } from '@contractor-ops/db';
import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { minorToMajor, minorUnitDigits } from '@contractor-ops/shared';
import { getServerEnv } from '@contractor-ops/validators';
import type { ConversationReference } from '@microsoft/agents-activity';
import { Activity } from '@microsoft/agents-activity';
import type {
  AdaptiveCardInvokeResponse,
  AdaptiveCardInvokeValue,
  TurnContext,
} from '@microsoft/agents-hosting';
import { CardFactory } from '@microsoft/agents-hosting';
import type {
  TaskModuleRequest,
  TaskModuleResponse,
} from '@microsoft/agents-hosting-extensions-teams';
import { TeamsActivityHandler } from '@microsoft/agents-hosting-extensions-teams';
import { z } from 'zod';
import {
  executeIntegrationApprovalApprove,
  executeIntegrationApprovalReject,
  IntegrationApprovalError,
} from '../approval-integration-action';
import { buildApprovalResultCard } from './cards/approval-result-card';
import { buildRejectModalCard } from './cards/reject-modal-card';
import { storeConversationReference } from './conversation-reference';

const log = createLogger({ service: 'teams-bot-handler' });

// ---------------------------------------------------------------------------
// Zod schemas for invoke payload validation (per CLAUDE.md: validate all
// external inputs with schema validation)
// ---------------------------------------------------------------------------

export const approveInvokeSchema = z.object({
  action: z.literal('approve_invoice'),
  invoiceId: z.string().min(1),
  flowId: z.string().min(1),
});

const rejectInvokeSchema = z.object({
  action: z.literal('reject_invoice'),
  invoiceId: z.string().min(1),
  flowId: z.string().min(1),
});

const submitRejectionSchema = z.object({
  action: z.literal('submit_rejection'),
  invoiceId: z.string().min(1),
  flowId: z.string().min(1),
  comment: z.string().min(1, 'Rejection comment is required'),
});

const taskModuleFetchSchema = z.object({
  invoiceId: z.string().min(1),
  flowId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// ConversationReference Storage — moved to `conversation-reference.ts`
// (import-cycle break); re-exported here for existing importers.
// ---------------------------------------------------------------------------

export { getConversationReference, storeConversationReference } from './conversation-reference';

// ---------------------------------------------------------------------------
// User Resolution
// ---------------------------------------------------------------------------

/**
 * Resolves an AAD Object ID to an internal user ID.
 * Looks up ExternalLink where externalType=TEAMS_USER and externalId matches.
 */
async function resolveTeamsUser(
  aadObjectId: string,
): Promise<{ userId: string; userName: string } | null> {
  const link = await prisma.externalLink.findFirst({
    where: {
      externalType: 'TEAMS_USER',
      externalId: aadObjectId,
    },
    select: {
      entityId: true,
    },
  });

  if (!link) return null;

  const user = await prisma.user.findUnique({
    where: { id: link.entityId },
    select: { id: true, name: true },
  });

  if (!user) return null;
  return { userId: user.id, userName: user.name ?? 'Unknown' };
}

async function resolveFlowOrganizationId(flowId: string): Promise<string | null> {
  const flow = await prisma.approvalFlow.findUnique({
    where: { id: flowId },
    select: { organizationId: true },
  });
  return flow?.organizationId ?? null;
}

function errorInvokeResponse(statusCode: number, message: string): AdaptiveCardInvokeResponse {
  return {
    statusCode,
    type: 'application/vnd.microsoft.error',
    value: { code: 'BadRequest', message },
  };
}

function cardInvokeResponse(card: Record<string, unknown>): AdaptiveCardInvokeResponse {
  return {
    statusCode: 200,
    type: 'application/vnd.microsoft.card.adaptive',
    value: card,
  };
}

// ---------------------------------------------------------------------------
// TeamsBotHandler
// ---------------------------------------------------------------------------

export class TeamsBotHandler extends TeamsActivityHandler {
  // -------------------------------------------------------------------------
  // Adaptive Card Actions (approve / reject from card buttons)
  // -------------------------------------------------------------------------

  override async onAdaptiveCardInvoke(
    context: TurnContext,
    invokeValue: AdaptiveCardInvokeValue,
  ): Promise<AdaptiveCardInvokeResponse> {
    const data = invokeValue.action?.data as Record<string, unknown> | undefined;
    if (!data) {
      return errorInvokeResponse(400, 'No action data provided');
    }

    const actionType = data.action as string | undefined;

    try {
      switch (actionType) {
        case 'approve_invoice':
          return await this.handleApproveInvoke(context, data);
        case 'reject_invoice':
          return await this.handleRejectInvoke(context, data);
        default:
          return errorInvokeResponse(400, `Unknown action: ${actionType}`);
      }
    } catch (error) {
      log.error({ err: error }, 'card invoke error');
      return errorInvokeResponse(500, 'Internal error processing action');
    }
  }

  // -------------------------------------------------------------------------
  // Task Module (reject modal with mandatory comment)
  // -------------------------------------------------------------------------

  override async handleTeamsTaskModuleFetch(
    _context: TurnContext,
    taskModuleRequest: TaskModuleRequest,
  ): Promise<TaskModuleResponse> {
    const parsed = taskModuleFetchSchema.safeParse(taskModuleRequest.data);
    if (!parsed.success) {
      return {
        task: {
          type: 'message',
          value: 'Invalid request data. Please try again.',
        },
      };
    }

    const { invoiceId, flowId } = parsed.data;

    return {
      task: {
        type: 'continue',
        value: {
          title: 'Reject Invoice',
          card: CardFactory.adaptiveCard(buildRejectModalCard(invoiceId, flowId)),
          width: 'medium',
          height: 'small',
        },
      },
    };
  }

  override async handleTeamsTaskModuleSubmit(
    context: TurnContext,
    taskModuleRequest: TaskModuleRequest,
  ): Promise<TaskModuleResponse> {
    const parsed = submitRejectionSchema.safeParse(taskModuleRequest.data);
    if (!parsed.success) {
      return {
        task: {
          type: 'message',
          value: parsed.error.issues[0]?.message ?? 'Invalid data. Please try again.',
        },
      };
    }

    const { flowId, comment } = parsed.data;

    // Resolve the acting user
    const aadObjectId = context.activity.from?.aadObjectId;
    if (!aadObjectId) {
      return {
        task: {
          type: 'message',
          value: 'Could not identify your account. Please try again.',
        },
      };
    }

    const user = await resolveTeamsUser(aadObjectId);
    if (!user) {
      return {
        task: {
          type: 'message',
          value: 'Your Teams account is not linked to Contractor Ops.',
        },
      };
    }

    try {
      const organizationId = await resolveFlowOrganizationId(flowId);
      if (!organizationId) {
        return { task: { type: 'message', value: 'Approval flow not found.' } };
      }

      await executeIntegrationApprovalReject(prisma, {
        organizationId,
        flowId,
        actorUserId: user.userId,
        actorName: user.userName,
        comment,
      });

      const flow = await prisma.approvalFlow.findUnique({
        where: { id: flowId },
        select: { resourceId: true, resourceType: true },
      });

      const invoice =
        flow?.resourceType === 'INVOICE'
          ? await prisma.invoice.findUnique({
              where: { id: flow.resourceId },
              select: {
                invoiceNumber: true,
                totalMinor: true,
                currency: true,
              },
            })
          : null;

      if (invoice && flow) {
        const resultCard = buildApprovalResultCard({
          result: 'rejected',
          invoiceNumber: invoice.invoiceNumber ?? 'N/A',
          amount: minorToMajor(invoice.totalMinor, invoice.currency).toFixed(
            minorUnitDigits(invoice.currency),
          ),
          currency: invoice.currency,
          approverName: user.userName,
          comment,
          viewUrl: `${getServerEnv().PUBLIC_APP_URL}/invoices/${flow.resourceId}`,
        });

        // Update the original card in-place. Agents SDK expects an
        // `Activity` instance; build via `Activity.fromObject` so the
        // typed methods (`applyConversationReference`, etc.) are present
        // when `TurnContext.updateActivity` calls them.
        const original = context.activity;
        if (original.replyToId) {
          const updated = Activity.fromObject({
            ...original,
            id: original.replyToId,
            type: 'message',
            attachments: [CardFactory.adaptiveCard(resultCard)],
          });
          await context.updateActivity(updated);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reject invoice';
      return { task: { type: 'message', value: message } };
    }

    return { task: { type: 'message', value: ' ' } };
  }

  // -------------------------------------------------------------------------
  // Private: Approve invoke handler
  // -------------------------------------------------------------------------

  private async handleApproveInvoke(
    context: TurnContext,
    data: Record<string, unknown>,
  ): Promise<AdaptiveCardInvokeResponse> {
    const parsed = approveInvokeSchema.safeParse(data);
    if (!parsed.success) {
      return errorInvokeResponse(400, 'Invalid payload');
    }

    const { flowId } = parsed.data;

    // Resolve user
    const aadObjectId = context.activity.from?.aadObjectId;
    if (!aadObjectId) {
      return errorInvokeResponse(403, 'Could not identify your account');
    }

    const user = await resolveTeamsUser(aadObjectId);
    if (!user) {
      return errorInvokeResponse(403, 'Your Teams account is not linked to Contractor Ops.');
    }

    try {
      const organizationId = await resolveFlowOrganizationId(flowId);
      if (!organizationId) {
        return errorInvokeResponse(404, 'Approval flow not found');
      }

      const result = await executeIntegrationApprovalApprove(prisma, {
        organizationId,
        flowId,
        actorUserId: user.userId,
        actorName: user.userName,
      });

      const resultCurrency = result.invoice?.currency ?? 'PLN';
      const resultCard = buildApprovalResultCard({
        result: 'approved',
        invoiceNumber: result.invoice?.invoiceNumber ?? 'N/A',
        amount: minorToMajor(result.invoice?.totalMinor ?? 0, resultCurrency).toFixed(
          minorUnitDigits(resultCurrency),
        ),
        currency: resultCurrency,
        approverName: user.userName,
        viewUrl: result.invoice
          ? `${getServerEnv().PUBLIC_APP_URL}/invoices/${result.invoice.id}`
          : '',
      });

      return cardInvokeResponse(resultCard);
    } catch (error) {
      if (error instanceof IntegrationApprovalError) {
        if (error.code === 'NOT_PENDING') {
          return cardInvokeResponse(
            buildApprovalResultCard({
              result: 'approved',
              invoiceNumber: 'N/A',
              amount: '0.00',
              currency: 'PLN',
              approverName: 'another approver',
              viewUrl: '',
            }),
          );
        }
        if (error.code === 'NOT_ASSIGNED' || error.code === 'FORBIDDEN') {
          return errorInvokeResponse(403, "You don't have permission to approve this invoice.");
        }
      }
      return errorInvokeResponse(500, 'Failed to process approval');
    }
  }

  // -------------------------------------------------------------------------
  // Private: Reject invoke handler (opens task module)
  // -------------------------------------------------------------------------

  private async handleRejectInvoke(
    _context: TurnContext,
    data: Record<string, unknown>,
  ): Promise<AdaptiveCardInvokeResponse> {
    const parsed = rejectInvokeSchema.safeParse(data);
    if (!parsed.success) {
      return errorInvokeResponse(400, 'Invalid payload');
    }

    return cardInvokeResponse({
      type: 'AdaptiveCard',
      version: '1.5',
      body: [{ type: 'TextBlock', text: 'Opening rejection form...', wrap: true }],
    });
  }

  // -------------------------------------------------------------------------
  // Conversation update: capture ConversationReference for proactive messaging
  // -------------------------------------------------------------------------
  // Override onTeamsMembersAdded to capture references when the bot is
  // installed or new members are added to a conversation.

  protected override async onTeamsMembersAdded(context: TurnContext): Promise<void> {
    await this.captureConversationReference(context);
  }

  /**
   * Called when the bot is installed in a personal scope or team.
   * Captures the ConversationReference for future proactive messaging.
   *
   * Agents SDK: the dedicated `onInstallationUpdateAddActivity` protected
   * hook was collapsed into a single `onInstallationUpdateActivity` (covers
   * both add + remove). We filter to `action === 'add'` so this only fires
   * on install, matching the previous behaviour.
   */
  protected override async onInstallationUpdateActivity(context: TurnContext): Promise<void> {
    const action = (context.activity as unknown as { action?: string }).action;
    if (action && action !== 'add') return;
    await this.captureConversationReference(context);
  }

  private async captureConversationReference(context: TurnContext): Promise<void> {
    try {
      // Agents SDK: `getConversationReference` moved from
      // `TurnContext.getConversationReference(activity)` (static) to an
      // instance method on Activity.
      const ref = context.activity.getConversationReference();

      // Look up the org by finding a MICROSOFT_TEAMS connection
      const tenantId = context.activity.conversation?.tenantId;
      if (!tenantId) return;

      const connection = await prisma.integrationConnection.findFirst({
        where: {
          provider: 'MICROSOFT_TEAMS',
          status: 'CONNECTED',
        },
        select: { id: true, organizationId: true },
      });

      if (!connection) return;

      await storeConversationReference(connection.organizationId, ref);
    } catch (error) {
      log.error({ err: error }, 'failed to capture conversation reference');
    }
  }
}

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

import type { Prisma } from "@contractor-ops/db";
import { prisma } from "@contractor-ops/db";
import type {
  AdaptiveCardInvokeResponse,
  AdaptiveCardInvokeValue,
  ConversationReference,
  TaskModuleRequest,
  TaskModuleResponse,
} from "botbuilder";
import { CardFactory, TeamsActivityHandler, TurnContext } from "botbuilder";
import { z } from "zod";
import { advanceFlow } from "../approval-engine.js";
import { buildApprovalResultCard } from "./cards/approval-result-card.js";
import { buildRejectModalCard } from "./cards/reject-modal-card.js";

// ---------------------------------------------------------------------------
// Zod schemas for invoke payload validation (per CLAUDE.md: validate all
// external inputs with schema validation)
// ---------------------------------------------------------------------------

const approveInvokeSchema = z.object({
  action: z.literal("approve_invoice"),
  invoiceId: z.string().uuid(),
  flowId: z.string().uuid(),
});

const rejectInvokeSchema = z.object({
  action: z.literal("reject_invoice"),
  invoiceId: z.string().uuid(),
  flowId: z.string().uuid(),
});

const submitRejectionSchema = z.object({
  action: z.literal("submit_rejection"),
  invoiceId: z.string().uuid(),
  flowId: z.string().uuid(),
  comment: z.string().min(1, "Rejection comment is required"),
});

const taskModuleFetchSchema = z.object({
  invoiceId: z.string().uuid(),
  flowId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// ConversationReference Storage
// ---------------------------------------------------------------------------

interface TeamsConnectionConfig {
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
    console.warn("[Teams] Cannot store ConversationReference: no aadObjectId");
    return;
  }

  const connection = await prisma.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: "MICROSOFT_TEAMS",
      status: "CONNECTED",
    },
    select: { id: true, configJson: true },
  });

  if (!connection) {
    console.warn(`[Teams] No MICROSOFT_TEAMS connection for org ${organizationId}`);
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
  if (channelId && ref.conversation?.conversationType === "channel") {
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
      provider: "MICROSOFT_TEAMS",
      status: "CONNECTED",
    },
    select: { configJson: true },
  });

  if (!connection) return null;

  const config = (connection.configJson as TeamsConnectionConfig) ?? {};
  return config.conversationReferences?.[aadObjectId] ?? null;
}

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
      externalType: "TEAMS_USER",
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
  return { userId: user.id, userName: user.name ?? "Unknown" };
}

// ---------------------------------------------------------------------------
// Error Helpers
// ---------------------------------------------------------------------------

function errorInvokeResponse(statusCode: number, message: string): AdaptiveCardInvokeResponse {
  return {
    statusCode,
    type: "application/vnd.microsoft.error",
    value: { code: "BadRequest", message },
  };
}

function cardInvokeResponse(card: Record<string, unknown>): AdaptiveCardInvokeResponse {
  return {
    statusCode: 200,
    type: "application/vnd.microsoft.card.adaptive",
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

  async onAdaptiveCardInvoke(
    context: TurnContext,
    invokeValue: AdaptiveCardInvokeValue,
  ): Promise<AdaptiveCardInvokeResponse> {
    const data = invokeValue.action?.data as Record<string, unknown> | undefined;
    if (!data) {
      return errorInvokeResponse(400, "No action data provided");
    }

    const actionType = data.action as string | undefined;

    try {
      switch (actionType) {
        case "approve_invoice":
          return await this.handleApproveInvoke(context, data);
        case "reject_invoice":
          return await this.handleRejectInvoke(context, data);
        default:
          return errorInvokeResponse(400, `Unknown action: ${actionType}`);
      }
    } catch (error) {
      console.error("[Teams] Card invoke error:", error);
      return errorInvokeResponse(500, "Internal error processing action");
    }
  }

  // -------------------------------------------------------------------------
  // Task Module (reject modal with mandatory comment)
  // -------------------------------------------------------------------------

  async handleTeamsTaskModuleFetch(
    context: TurnContext,
    taskModuleRequest: TaskModuleRequest,
  ): Promise<TaskModuleResponse> {
    const parsed = taskModuleFetchSchema.safeParse(taskModuleRequest.data);
    if (!parsed.success) {
      return {
        task: {
          type: "message",
          value: "Invalid request data. Please try again.",
        },
      };
    }

    const { invoiceId, flowId } = parsed.data;

    return {
      task: {
        type: "continue",
        value: {
          title: "Reject Invoice",
          card: CardFactory.adaptiveCard(buildRejectModalCard(invoiceId, flowId)),
          width: "medium",
          height: "small",
        },
      },
    };
  }

  async handleTeamsTaskModuleSubmit(
    context: TurnContext,
    taskModuleRequest: TaskModuleRequest,
  ): Promise<TaskModuleResponse> {
    const parsed = submitRejectionSchema.safeParse(taskModuleRequest.data);
    if (!parsed.success) {
      return {
        task: {
          type: "message",
          value: parsed.error.issues[0]?.message ?? "Invalid data. Please try again.",
        },
      };
    }

    const { flowId, comment } = parsed.data;

    // Resolve the acting user
    const aadObjectId = context.activity.from?.aadObjectId;
    if (!aadObjectId) {
      return {
        task: {
          type: "message",
          value: "Could not identify your account. Please try again.",
        },
      };
    }

    const user = await resolveTeamsUser(aadObjectId);
    if (!user) {
      return {
        task: {
          type: "message",
          value: "Your Teams account is not linked to Contractor Ops.",
        },
      };
    }

    try {
      // Process rejection in a transaction
      await this.processRejection(flowId, user.userId, comment);

      const flow = await prisma.approvalFlow.findUnique({
        where: { id: flowId },
        select: { resourceId: true, resourceType: true },
      });

      const invoice =
        flow?.resourceType === "INVOICE"
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
          result: "rejected",
          invoiceNumber: invoice.invoiceNumber ?? "N/A",
          amount: (invoice.totalMinor / 100).toFixed(2),
          currency: invoice.currency,
          approverName: user.userName,
          comment,
          viewUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/invoices/${flow.resourceId}`,
        });

        // Update the original card in-place
        const activity = context.activity;
        if (activity.replyToId) {
          await context.updateActivity({
            ...activity,
            id: activity.replyToId,
            type: "message",
            attachments: [CardFactory.adaptiveCard(resultCard)],
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reject invoice";
      return { task: { type: "message", value: message } };
    }

    return { task: { type: "message", value: " " } };
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
      return errorInvokeResponse(400, "Invalid payload");
    }

    const { flowId } = parsed.data;

    // Resolve user
    const aadObjectId = context.activity.from?.aadObjectId;
    if (!aadObjectId) {
      return errorInvokeResponse(403, "Could not identify your account");
    }

    const user = await resolveTeamsUser(aadObjectId);
    if (!user) {
      return errorInvokeResponse(403, "Your Teams account is not linked to Contractor Ops.");
    }

    try {
      const result = await this.processApproval(flowId, user.userId);

      const resultCard = buildApprovalResultCard({
        result: "approved",
        invoiceNumber: result.invoiceNumber,
        amount: result.amount,
        currency: result.currency,
        approverName: user.userName,
        viewUrl: result.viewUrl,
      });

      return cardInvokeResponse(resultCard);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "APPROVAL_STEP_NOT_PENDING") {
          return cardInvokeResponse(
            buildApprovalResultCard({
              result: "approved",
              invoiceNumber: "N/A",
              amount: "0.00",
              currency: "PLN",
              approverName: "another approver",
              viewUrl: "",
            }),
          );
        }
        if (error.message === "APPROVAL_NOT_ASSIGNED") {
          return errorInvokeResponse(403, "You don't have permission to approve this invoice.");
        }
      }
      return errorInvokeResponse(500, "Failed to process approval");
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
      return errorInvokeResponse(400, "Invalid payload");
    }

    return cardInvokeResponse({
      type: "AdaptiveCard",
      version: "1.5",
      body: [{ type: "TextBlock", text: "Opening rejection form...", wrap: true }],
    });
  }

  // -------------------------------------------------------------------------
  // Private: Process approval via Prisma transaction
  // -------------------------------------------------------------------------

  private async processApproval(
    flowId: string,
    userId: string,
  ): Promise<{
    invoiceNumber: string;
    amount: string;
    currency: string;
    viewUrl: string;
  }> {
    return prisma.$transaction(async (tx) => {
      // Find the pending step assigned to this user
      const step = await tx.approvalStep.findFirst({
        where: {
          approvalFlowId: flowId,
          approverUserId: userId,
          status: "PENDING",
        },
        include: {
          approvalFlow: {
            select: {
              id: true,
              resourceId: true,
              resourceType: true,
            },
          },
        },
      });

      if (!step) {
        // Check if the step exists but is not pending
        const existingStep = await tx.approvalStep.findFirst({
          where: { approvalFlowId: flowId, approverUserId: userId },
        });
        if (existingStep) {
          throw new Error("APPROVAL_STEP_NOT_PENDING");
        }
        throw new Error("APPROVAL_NOT_ASSIGNED");
      }

      const flow = step.approvalFlow;
      const invoice =
        flow.resourceType === "INVOICE"
          ? await tx.invoice.findUnique({
              where: { id: flow.resourceId },
              select: {
                id: true,
                invoiceNumber: true,
                totalMinor: true,
                currency: true,
              },
            })
          : null;

      // Create decision
      await tx.approvalDecision.create({
        data: {
          organizationId: step.organizationId,
          approvalStepId: step.id,
          actorUserId: userId,
          decision: "APPROVE",
        },
      });

      // Update step
      await tx.approvalStep.update({
        where: { id: step.id },
        data: {
          status: "APPROVED",
          actedAt: new Date(),
          decision: "APPROVE",
        },
      });

      // Advance flow
      const advanceResult = await advanceFlow(tx, step.approvalFlowId);

      // If flow completed, update invoice
      if (advanceResult.completed && flow.resourceType === "INVOICE") {
        await tx.invoice.update({
          where: { id: flow.resourceId },
          data: {
            status: "APPROVED",
            paymentStatus: "READY",
            readyForPaymentAt: new Date(),
          },
        });
      }

      return {
        invoiceNumber: invoice?.invoiceNumber ?? "N/A",
        amount: ((invoice?.totalMinor ?? 0) / 100).toFixed(2),
        currency: invoice?.currency ?? "PLN",
        viewUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/invoices/${flow.resourceId}`,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Private: Process rejection via Prisma transaction
  // -------------------------------------------------------------------------

  private async processRejection(flowId: string, userId: string, comment: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const step = await tx.approvalStep.findFirst({
        where: {
          approvalFlowId: flowId,
          approverUserId: userId,
          status: "PENDING",
        },
      });

      if (!step) {
        throw new Error("No pending approval step found for this user");
      }

      // Create decision
      await tx.approvalDecision.create({
        data: {
          organizationId: step.organizationId,
          approvalStepId: step.id,
          actorUserId: userId,
          decision: "REJECT",
          comment,
        },
      });

      // Update step
      await tx.approvalStep.update({
        where: { id: step.id },
        data: {
          status: "REJECTED",
          actedAt: new Date(),
          decision: "REJECT",
          comment,
        },
      });

      // Mark flow as REJECTED
      await tx.approvalFlow.update({
        where: { id: flowId },
        data: { status: "REJECTED" },
      });

      // Update invoice status
      const flow = await tx.approvalFlow.findUnique({
        where: { id: flowId },
        select: { resourceId: true },
      });

      if (flow?.resourceId) {
        await tx.invoice.update({
          where: { id: flow.resourceId },
          data: { status: "REJECTED" },
        });
      }
    });
  }

  // -------------------------------------------------------------------------
  // Conversation update: capture ConversationReference for proactive messaging
  // -------------------------------------------------------------------------
  // Override onTeamsMembersAdded to capture references when the bot is
  // installed or new members are added to a conversation.

  protected async onTeamsMembersAdded(context: TurnContext): Promise<void> {
    await this.captureConversationReference(context);
  }

  /**
   * Called when the bot is installed in a personal scope or team.
   * Captures the ConversationReference for future proactive messaging.
   */
  protected async onInstallationUpdateAddActivity(context: TurnContext): Promise<void> {
    await this.captureConversationReference(context);
  }

  private async captureConversationReference(context: TurnContext): Promise<void> {
    try {
      const ref = TurnContext.getConversationReference(context.activity);

      // Look up the org by finding a MICROSOFT_TEAMS connection
      const tenantId = context.activity.conversation?.tenantId;
      if (!tenantId) return;

      const connection = await prisma.integrationConnection.findFirst({
        where: {
          provider: "MICROSOFT_TEAMS",
          status: "CONNECTED",
        },
        select: { id: true, organizationId: true },
      });

      if (!connection) return;

      await storeConversationReference(connection.organizationId, ref);
    } catch (error) {
      console.error("[Teams] Failed to capture conversation reference:", error);
    }
  }
}

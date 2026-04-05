import { describe, it, expect, vi, beforeEach } from "vitest";
import { TeamsBotHandler } from "../teams-bot-handler.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@contractor-ops/db", () => ({
  prisma: {
    externalLink: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    approvalStep: {
      findFirst: vi.fn(),
    },
    approvalDecision: {
      create: vi.fn(),
    },
    approvalFlow: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    invoice: {
      update: vi.fn(),
    },
    integrationConnection: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        approvalStep: {
          findFirst: vi.fn(),
          update: vi.fn(),
        },
        approvalDecision: {
          create: vi.fn(),
        },
        approvalFlow: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        invoice: {
          update: vi.fn(),
        },
      }),
    ),
  },
}));

vi.mock("../cards/approval-result-card.js", () => ({
  buildApprovalResultCard: vi.fn(() => ({
    type: "AdaptiveCard",
    body: [{ type: "TextBlock", text: "Result" }],
  })),
}));

vi.mock("../cards/reject-modal-card.js", () => ({
  buildRejectModalCard: vi.fn(() => ({
    type: "AdaptiveCard",
    body: [{ type: "TextBlock", text: "Reject Modal" }],
  })),
}));

vi.mock("../../approval-engine.js", () => ({
  advanceFlow: vi.fn(() => ({ completed: false })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContext(overrides: Record<string, unknown> = {}) {
  return {
    activity: {
      from: {
        aadObjectId: "aad-123",
        id: "user-123",
        name: "Test User",
      },
      conversation: {
        id: "conv-123",
        tenantId: "tenant-123",
      },
      replyToId: "reply-123",
      ...overrides,
    },
    updateActivity: vi.fn(),
    sendActivity: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TeamsBotHandler", () => {
  let handler: TeamsBotHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new TeamsBotHandler();
  });

  describe("onAdaptiveCardInvoke", () => {
    it("returns 400 for missing action data", async () => {
      const context = createMockContext();
      const result = await handler.onAdaptiveCardInvoke(
        context as never,
        { action: {} } as never,
      );

      expect(result.statusCode).toBe(400);
      expect(result.type).toBe("application/vnd.microsoft.error");
    });

    it("returns 400 for unknown action type", async () => {
      const context = createMockContext();
      const result = await handler.onAdaptiveCardInvoke(
        context as never,
        { action: { data: { action: "unknown_action" } } } as never,
      );

      expect(result.statusCode).toBe(400);
    });

    it("returns 400 for invalid UUID in approve_invoice payload", async () => {
      const context = createMockContext();
      const result = await handler.onAdaptiveCardInvoke(
        context as never,
        {
          action: {
            data: {
              action: "approve_invoice",
              invoiceId: "not-a-uuid",
              flowId: "also-not-uuid",
            },
          },
        } as never,
      );

      expect(result.statusCode).toBe(400);
      expect(result.type).toBe("application/vnd.microsoft.error");
    });

    it("returns 400 for missing required fields in approve_invoice", async () => {
      const context = createMockContext();
      const result = await handler.onAdaptiveCardInvoke(
        context as never,
        {
          action: {
            data: {
              action: "approve_invoice",
              // Missing invoiceId and flowId
            },
          },
        } as never,
      );

      expect(result.statusCode).toBe(400);
    });

    it("returns 403 when user is not linked to Contractor Ops", async () => {
      const { prisma } = await import("@contractor-ops/db");

      // User resolution returns null (no ExternalLink)
      vi.mocked(prisma.externalLink.findFirst).mockResolvedValue(null);

      const context = createMockContext();
      const result = await handler.onAdaptiveCardInvoke(
        context as never,
        {
          action: {
            data: {
              action: "approve_invoice",
              invoiceId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
              flowId: "f1e2d3c4-b5a6-7890-dcba-0987654321fe",
            },
          },
        } as never,
      );

      expect(result.statusCode).toBe(403);
    });

    it("returns adaptive card for reject_invoice with valid UUIDs", async () => {
      const context = createMockContext();
      const result = await handler.onAdaptiveCardInvoke(
        context as never,
        {
          action: {
            data: {
              action: "reject_invoice",
              invoiceId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
              flowId: "f1e2d3c4-b5a6-7890-dcba-0987654321fe",
            },
          },
        } as never,
      );

      expect(result.statusCode).toBe(200);
      expect(result.type).toBe("application/vnd.microsoft.card.adaptive");
    });

    it("calls advanceFlow for approve_invoice with valid data and linked user", async () => {
      const { prisma } = await import("@contractor-ops/db");
      const { advanceFlow } = await import("../../approval-engine.js");

      // Mock user resolution
      vi.mocked(prisma.externalLink.findFirst).mockResolvedValue({
        id: "link-1",
        entityId: "user-internal-1",
        entityType: "USER",
        externalId: "aad-123",
        externalType: "TEAMS_USER",
        externalUrl: null,
        metadataJson: null,
        organizationId: "org-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-internal-1",
        name: "Test User",
      } as never);

      // Mock transaction to execute and return result
      const mockStep = {
        id: "step-1",
        organizationId: "org-1",
        approvalFlowId: "flow-1",
        approverUserId: "user-internal-1",
        status: "PENDING",
        approvalFlow: {
          id: "flow-1",
          resourceId: "invoice-1",
          invoice: {
            id: "invoice-1",
            invoiceNumber: "INV-001",
            totalGrosze: 10000,
            currency: "PLN",
          },
        },
      };

      vi.mocked(prisma.$transaction).mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            approvalStep: {
              findFirst: vi.fn().mockResolvedValue(mockStep),
              update: vi.fn().mockResolvedValue(mockStep),
            },
            approvalDecision: {
              create: vi.fn(),
            },
            approvalFlow: {
              findUnique: vi.fn(),
              update: vi.fn(),
            },
            invoice: {
              update: vi.fn(),
            },
          };
          return fn(tx);
        },
      );

      vi.mocked(advanceFlow).mockResolvedValue({
        completed: false,
      } as never);

      const context = createMockContext();
      const result = await handler.onAdaptiveCardInvoke(
        context as never,
        {
          action: {
            data: {
              action: "approve_invoice",
              invoiceId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
              flowId: "f1e2d3c4-b5a6-7890-dcba-0987654321fe",
            },
          },
        } as never,
      );

      expect(result.statusCode).toBe(200);
      expect(result.type).toBe("application/vnd.microsoft.card.adaptive");
    });
  });

  describe("handleTeamsTaskModuleFetch", () => {
    it("returns reject modal card for valid data", async () => {
      const context = createMockContext();
      const result = await handler.handleTeamsTaskModuleFetch(
        context as never,
        {
          data: {
            invoiceId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            flowId: "f1e2d3c4-b5a6-7890-dcba-0987654321fe",
          },
        } as never,
      );

      expect(result.task?.type).toBe("continue");
      if (result.task?.type === "continue") {
        expect(result.task.value?.title).toBe("Reject Invoice");
      }
    });

    it("returns error message for invalid data", async () => {
      const context = createMockContext();
      const result = await handler.handleTeamsTaskModuleFetch(
        context as never,
        {
          data: {
            invoiceId: "not-uuid",
          },
        } as never,
      );

      expect(result.task?.type).toBe("message");
    });
  });

  describe("handleTeamsTaskModuleSubmit", () => {
    it("returns error for invalid submission data", async () => {
      const context = createMockContext();
      const result = await handler.handleTeamsTaskModuleSubmit(
        context as never,
        {
          data: {
            action: "submit_rejection",
            invoiceId: "not-uuid",
            flowId: "not-uuid",
            comment: "",
          },
        } as never,
      );

      expect(result).not.toBeNull();
      expect(result?.task?.type).toBe("message");
    });

    it("returns error when user has no aadObjectId", async () => {
      const context = createMockContext({
        from: { id: "user-1", name: "Test" },
      });
      const result = await handler.handleTeamsTaskModuleSubmit(
        context as never,
        {
          data: {
            action: "submit_rejection",
            invoiceId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            flowId: "f1e2d3c4-b5a6-7890-dcba-0987654321fe",
            comment: "Not correct",
          },
        } as never,
      );

      expect(result).not.toBeNull();
      expect(result?.task?.type).toBe("message");
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamsBotHandler } from '../teams-bot-handler';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/db', () => {
  const MockDbPrisma = {
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
  };
  return {
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
    prisma: MockDbPrisma,
    prismaRaw: MockDbPrisma,
  };
});

vi.mock('../cards/approval-result-card', () => ({
  buildApprovalResultCard: vi.fn(() => ({
    type: 'AdaptiveCard',
    body: [{ type: 'TextBlock', text: 'Result' }],
  })),
}));

vi.mock('../cards/reject-modal-card', () => ({
  buildRejectModalCard: vi.fn(() => ({
    type: 'AdaptiveCard',
    body: [{ type: 'TextBlock', text: 'Reject Modal' }],
  })),
}));

vi.mock('../../approval-engine', () => ({
  advanceFlow: vi.fn(() => ({ completed: false })),
}));

const mockExecuteIntegrationApprovalApprove = vi.hoisted(() => vi.fn());

vi.mock('../../approval-integration-action', () => ({
  executeIntegrationApprovalApprove: mockExecuteIntegrationApprovalApprove,
  IntegrationApprovalError: class IntegrationApprovalError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContext(overrides: Record<string, unknown> = {}) {
  return {
    activity: {
      from: {
        aadObjectId: 'aad-123',
        id: 'user-123',
        name: 'Test User',
      },
      conversation: {
        id: 'conv-123',
        tenantId: 'tenant-123',
      },
      replyToId: 'reply-123',
      ...overrides,
    },
    updateActivity: vi.fn(),
    sendActivity: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TeamsBotHandler', () => {
  let handler: TeamsBotHandler;

  beforeEach(() => {
    mockExecuteIntegrationApprovalApprove.mockReset();
    handler = new TeamsBotHandler();
  });

  describe('onAdaptiveCardInvoke', () => {
    it('returns 400 for missing action data', async () => {
      const context = createMockContext();
      const result = await handler.onAdaptiveCardInvoke(context as never, { action: {} } as never);

      expect(result.statusCode).toBe(400);
      expect(result.type).toBe('application/vnd.microsoft.error');
    });

    it('returns 400 for unknown action type', async () => {
      const context = createMockContext();
      const result = await handler.onAdaptiveCardInvoke(
        context as never,
        { action: { data: { action: 'unknown_action' } } } as never,
      );

      expect(result.statusCode).toBe(400);
    });

    it('returns 400 for empty ids in approve_invoice payload', async () => {
      const context = createMockContext();
      const result = await handler.onAdaptiveCardInvoke(
        context as never,
        {
          action: {
            data: {
              action: 'approve_invoice',
              invoiceId: '',
              flowId: '',
            },
          },
        } as never,
      );

      expect(result.statusCode).toBe(400);
      expect(result.type).toBe('application/vnd.microsoft.error');
    });

    it('returns 400 for missing required fields in approve_invoice', async () => {
      const context = createMockContext();
      const result = await handler.onAdaptiveCardInvoke(
        context as never,
        {
          action: {
            data: {
              action: 'approve_invoice',
              // Missing invoiceId and flowId
            },
          },
        } as never,
      );

      expect(result.statusCode).toBe(400);
    });

    it('returns 403 when user is not linked to Contractor Ops', async () => {
      const { prisma } = await import('@contractor-ops/db');

      // User resolution returns null (no ExternalLink)
      vi.mocked(prisma.externalLink.findFirst).mockResolvedValue(null);

      const context = createMockContext();
      const result = await handler.onAdaptiveCardInvoke(
        context as never,
        {
          action: {
            data: {
              action: 'approve_invoice',
              invoiceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              flowId: 'f1e2d3c4-b5a6-7890-acba-0987654321fe',
            },
          },
        } as never,
      );

      expect(result.statusCode).toBe(403);
    });

    it('returns adaptive card for reject_invoice with valid UUIDs', async () => {
      const context = createMockContext();
      const result = await handler.onAdaptiveCardInvoke(
        context as never,
        {
          action: {
            data: {
              action: 'reject_invoice',
              invoiceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              flowId: 'f1e2d3c4-b5a6-7890-acba-0987654321fe',
            },
          },
        } as never,
      );

      expect(result.statusCode).toBe(200);
      expect(result.type).toBe('application/vnd.microsoft.card.adaptive');
    });

    it('calls executeIntegrationApprovalApprove for approve_invoice with valid data and linked user', async () => {
      const { prisma } = await import('@contractor-ops/db');

      vi.mocked(prisma.externalLink.findFirst).mockResolvedValue({
        id: 'link-1',
        entityId: 'user-internal-1',
        entityType: 'USER',
        externalId: 'aad-123',
        externalType: 'TEAMS_USER',
        externalUrl: null,
        metadataJson: null,
        organizationId: 'org-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-internal-1',
        name: 'Test User',
      } as never);

      vi.mocked(prisma.approvalFlow.findUnique).mockResolvedValue({
        organizationId: 'org-1',
      } as never);

      mockExecuteIntegrationApprovalApprove.mockResolvedValue({
        invoice: {
          id: 'clinvaaaaaaaaaaaaaaaaaaaaa',
          invoiceNumber: 'INV-001',
          totalMinor: 10000,
          currency: 'PLN',
        },
      });

      const context = createMockContext();
      const result = await handler.onAdaptiveCardInvoke(
        context as never,
        {
          action: {
            data: {
              action: 'approve_invoice',
              invoiceId: 'clinvaaaaaaaaaaaaaaaaaaaaa',
              flowId: 'clflowaaaaaaaaaaaaaaaaaaaa',
            },
          },
        } as never,
      );

      expect(result.statusCode).toBe(200);
      expect(result.type).toBe('application/vnd.microsoft.card.adaptive');
      expect(mockExecuteIntegrationApprovalApprove).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          organizationId: 'org-1',
          flowId: 'clflowaaaaaaaaaaaaaaaaaaaa',
          actorUserId: 'user-internal-1',
        }),
      );
    });
  });

  describe('handleTeamsTaskModuleFetch', () => {
    it('returns reject modal card for valid data', async () => {
      const context = createMockContext();
      const result = await handler.handleTeamsTaskModuleFetch(
        context as never,
        {
          data: {
            invoiceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            flowId: 'f1e2d3c4-b5a6-7890-acba-0987654321fe',
          },
        } as never,
      );

      expect(result.task?.type).toBe('continue');
      if (result.task?.type === 'continue') {
        expect(result.task.value?.title).toBe('Reject Invoice');
      }
    });

    it('returns error message for invalid data', async () => {
      const context = createMockContext();
      const result = await handler.handleTeamsTaskModuleFetch(
        context as never,
        {
          data: {
            invoiceId: 'not-uuid',
          },
        } as never,
      );

      expect(result.task?.type).toBe('message');
    });
  });

  describe('handleTeamsTaskModuleSubmit', () => {
    it('returns error for invalid submission data', async () => {
      const context = createMockContext();
      const result = await handler.handleTeamsTaskModuleSubmit(
        context as never,
        {
          data: {
            action: 'submit_rejection',
            invoiceId: 'not-uuid',
            flowId: 'not-uuid',
            comment: '',
          },
        } as never,
      );

      expect(result).not.toBeNull();
      expect(result?.task?.type).toBe('message');
    });

    it('returns error when user has no aadObjectId', async () => {
      const context = createMockContext({
        from: { id: 'user-1', name: 'Test' },
      });
      const result = await handler.handleTeamsTaskModuleSubmit(
        context as never,
        {
          data: {
            action: 'submit_rejection',
            invoiceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            flowId: 'f1e2d3c4-b5a6-7890-acba-0987654321fe',
            comment: 'Not correct',
          },
        } as never,
      );

      expect(result).not.toBeNull();
      expect(result?.task?.type).toBe('message');
    });
  });
});

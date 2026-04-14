/** @vitest-environment node */

import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockExternalLinkFindFirst,
  mockUserFindUnique,
  mockApprovalFlowFindUniqueOrThrow,
  mockApprovalStepUpdate,
  mockApprovalDecisionCreate,
  mockApprovalFlowUpdate,
  mockTransaction,
  mockAdvanceFlow,
  mockGetSlackClient,
  mockUpdateMessageToResult,
} = vi.hoisted(() => ({
  mockExternalLinkFindFirst: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockApprovalFlowFindUniqueOrThrow: vi.fn(),
  mockApprovalStepUpdate: vi.fn(),
  mockApprovalDecisionCreate: vi.fn(),
  mockApprovalFlowUpdate: vi.fn(),
  mockTransaction: vi.fn(),
  mockAdvanceFlow: vi.fn(),
  mockGetSlackClient: vi.fn(),
  mockUpdateMessageToResult: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    externalLink: { findFirst: mockExternalLinkFindFirst },
    user: { findUnique: mockUserFindUnique },
    $transaction: mockTransaction,
  },
}));

vi.mock('@contractor-ops/api/services/approval-engine', () => ({
  advanceFlow: mockAdvanceFlow,
}));

vi.mock('@contractor-ops/api/services/slack-client', () => ({
  getSlackClient: mockGetSlackClient,
  updateMessageToResult: mockUpdateMessageToResult,
}));

import { POST } from '../route';

const SIGNING_SECRET = 'test-signing-secret';

function makeSlackRequest(payload: unknown): NextRequest {
  const bodyStr = `payload=${encodeURIComponent(JSON.stringify(payload))}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sigBasestring = `v0:${timestamp}:${bodyStr}`;
  const signature = `v0=${createHmac('sha256', SIGNING_SECRET).update(sigBasestring).digest('hex')}`;

  return new NextRequest('http://localhost/api/slack/interactivity', {
    method: 'POST',
    body: bodyStr,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': signature,
    },
  });
}

function makeRawSlackRequest(body: string, timestamp: string, signature: string): NextRequest {
  return new NextRequest('http://localhost/api/slack/interactivity', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': signature,
    },
  });
}

describe('POST /api/slack/interactivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SLACK_SIGNING_SECRET = SIGNING_SECRET;

    mockExternalLinkFindFirst.mockResolvedValue({
      entityId: 'user-1',
      organizationId: 'org-1',
    });
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', name: 'Test User' });
    mockUpdateMessageToResult.mockResolvedValue(undefined);
    mockTransaction.mockImplementation(async (fn: (...args: unknown[]) => unknown) => {
      const tx = {
        approvalFlow: {
          findUniqueOrThrow: mockApprovalFlowFindUniqueOrThrow,
          update: mockApprovalFlowUpdate,
        },
        approvalStep: { update: mockApprovalStepUpdate },
        approvalDecision: { create: mockApprovalDecisionCreate },
      };
      return fn(tx);
    });
  });

  it('returns 401 when signature is invalid', async () => {
    const req = makeRawSlackRequest('payload=test', '1234567890', 'v0=invalidsig');
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: 'Invalid signature',
    });
  });

  it('returns 401 when timestamp is stale (>5 minutes)', async () => {
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 600);
    const bodyStr = 'payload=test';
    const sigBasestring = `v0:${staleTimestamp}:${bodyStr}`;
    const signature = `v0=${createHmac('sha256', SIGNING_SECRET).update(sigBasestring).digest('hex')}`;

    const req = makeRawSlackRequest(bodyStr, staleTimestamp, signature);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when payload is missing', async () => {
    const bodyStr = 'no_payload=true';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const sigBasestring = `v0:${timestamp}:${bodyStr}`;
    const signature = `v0=${createHmac('sha256', SIGNING_SECRET).update(sigBasestring).digest('hex')}`;

    const req = makeRawSlackRequest(bodyStr, timestamp, signature);
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: 'Missing payload',
    });
  });

  it('returns 200 and processes block_actions for approve_invoice', async () => {
    mockApprovalFlowFindUniqueOrThrow.mockResolvedValue({
      id: 'flow-1',
      currentStepOrder: 1,
      steps: [{ id: 'step-1', stepOrder: 1, status: 'PENDING' }],
    });
    mockApprovalStepUpdate.mockResolvedValue({});
    mockApprovalDecisionCreate.mockResolvedValue({});
    mockAdvanceFlow.mockResolvedValue(undefined);

    const payload = {
      type: 'block_actions',
      user: { id: 'slack-u1', name: 'testuser' },
      actions: [
        {
          action_id: 'approve_invoice',
          value: JSON.stringify({ invoiceId: 'inv-1', flowId: 'flow-1' }),
        },
      ],
      channel: { id: 'C123' },
      message: { ts: '1234.5678' },
    };

    const req = makeSlackRequest(payload);
    const res = await POST(req);

    expect(res.status).toBe(200);

    // Allow async processing to complete
    await vi.waitFor(() => {
      expect(mockUpdateMessageToResult).toHaveBeenCalled();
    });

    expect(mockTransaction).toHaveBeenCalled();
    expect(mockUpdateMessageToResult).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        channel: 'C123',
        ts: '1234.5678',
        result: 'approved',
        actorName: 'Test User',
      }),
    );
  });

  it('returns response_action:clear for view_submission', async () => {
    const payload = {
      type: 'view_submission',
      user: { id: 'slack-u1', name: 'testuser' },
      view: {
        callback_id: 'reject_invoice_modal',
        private_metadata: JSON.stringify({
          invoiceId: 'inv-1',
          flowId: 'flow-1',
          channel: 'C123',
          messageTs: '1234.5678',
        }),
        state: {
          values: {
            comment_block: {
              comment_input: { value: 'Too expensive' },
            },
          },
        },
      },
    };

    mockApprovalFlowFindUniqueOrThrow.mockResolvedValue({
      id: 'flow-1',
      currentStepOrder: 1,
      steps: [{ id: 'step-1', stepOrder: 1, status: 'PENDING' }],
    });
    mockApprovalStepUpdate.mockResolvedValue({});
    mockApprovalDecisionCreate.mockResolvedValue({});
    mockApprovalFlowUpdate.mockResolvedValue({});

    const req = makeSlackRequest(payload);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = (await res.json()) as { response_action: string };
    expect(json.response_action).toBe('clear');
  });
});

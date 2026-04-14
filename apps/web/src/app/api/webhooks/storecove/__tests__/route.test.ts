/** @vitest-environment node */

/**
 * Phase 61 · Plan 61-06 Task 2 — Storecove webhook handler tests.
 *
 * Coverage:
 *   1. Valid signature + success event → lifecycle updated to DELIVERED +
 *      DELIVERY_ACK event row written.
 *   2. Valid signature + failed event → lifecycle updated to FAILED +
 *      DELIVERY_FAILED event row written.
 *   3. Invalid signature → 401, no DB writes.
 *   4. Unknown event type → 200, no DB writes.
 *   5. Re-delivery idempotency — same guid twice → only one event written.
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const GUID = 'sc-msg-guid-1';

const {
  mockPrisma,
  mockVerifyWebhookSignature,
  mockParseWebhookPayload,
  mockCreateLogger,
} = vi.hoisted(() => {
  return {
    mockPrisma: {
      eInvoiceLifecycle: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      eInvoiceLifecycleEvent: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(
        async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma),
      ),
    },
    mockVerifyWebhookSignature: vi.fn(),
    mockParseWebhookPayload: vi.fn(),
    mockCreateLogger: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  };
});

// Rebind mockPrisma.$transaction so it closes over the final object after
// vi.hoisted; vitest's hoister leaves the local `mockPrisma` reference
// valid across the whole module.

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@contractor-ops/einvoice', () => ({
  StorecoveAdapter: class {
    verifyWebhookSignature(_body: string, _headers: Record<string, string>) {
      return mockVerifyWebhookSignature(_body, _headers);
    }
    async parseWebhookPayload(body: string, headers: Record<string, string>) {
      return mockParseWebhookPayload(body, headers);
    }
  },
}));

vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: vi.fn(() => ({ STORECOVE_WEBHOOK_SECRET: 'test-secret' })),
}));

vi.mock('@contractor-ops/logger', () => ({
  createLogger: mockCreateLogger,
}));

import { POST } from '../route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/webhooks/storecove', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyWebhookSignature.mockReturnValue({
    valid: true,
    eventType: 'invoice.transmission.success',
  });
  mockParseWebhookPayload.mockResolvedValue({
    documentId: GUID,
    senderParticipantId: '',
    receiverParticipantId: '',
    xml: '',
    receivedAt: new Date(),
    metadata: { event: 'invoice.transmission.success', guid: GUID },
  });
  mockPrisma.eInvoiceLifecycle.findFirst.mockResolvedValue({
    id: 'lc-1',
    organizationId: 'org-1',
    transmissionStatus: 'SENT',
  });
  mockPrisma.eInvoiceLifecycleEvent.findFirst.mockResolvedValue(null); // not yet recorded
  mockPrisma.eInvoiceLifecycle.update.mockResolvedValue(undefined);
  mockPrisma.eInvoiceLifecycleEvent.create.mockResolvedValue(undefined);
  // Re-bind $transaction since clearAllMocks resets the impl.
  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma),
  );
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/storecove', () => {
  it('valid signature + success event → lifecycle DELIVERED + DELIVERY_ACK event', async () => {
    const res = await POST(buildRequest({ event: 'invoice.transmission.success', guid: GUID }));
    expect(res.status).toBe(200);

    expect(mockPrisma.eInvoiceLifecycle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lc-1' },
        data: expect.objectContaining({ transmissionStatus: 'DELIVERED' }),
      }),
    );
    expect(mockPrisma.eInvoiceLifecycleEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'DELIVERY_ACK',
          lifecycleId: 'lc-1',
        }),
      }),
    );
  });

  it('valid signature + failed event → lifecycle FAILED + DELIVERY_FAILED event', async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce({
      valid: true,
      eventType: 'invoice.transmission.failed',
    });
    mockParseWebhookPayload.mockResolvedValueOnce({
      documentId: GUID,
      senderParticipantId: '',
      receiverParticipantId: '',
      xml: '',
      receivedAt: new Date(),
      metadata: { event: 'invoice.transmission.failed', guid: GUID },
    });

    const res = await POST(buildRequest({ event: 'invoice.transmission.failed', guid: GUID }));
    expect(res.status).toBe(200);

    expect(mockPrisma.eInvoiceLifecycle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lc-1' },
        data: expect.objectContaining({ transmissionStatus: 'FAILED' }),
      }),
    );
    expect(mockPrisma.eInvoiceLifecycleEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'DELIVERY_FAILED',
          lifecycleId: 'lc-1',
        }),
      }),
    );
  });

  it('invalid signature → 401, no DB writes', async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce({ valid: false });

    const res = await POST(buildRequest({ event: 'invoice.transmission.success', guid: GUID }));
    expect(res.status).toBe(401);

    expect(mockPrisma.eInvoiceLifecycle.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.eInvoiceLifecycle.update).not.toHaveBeenCalled();
    expect(mockPrisma.eInvoiceLifecycleEvent.create).not.toHaveBeenCalled();
  });

  it('unknown event type → 200, no DB writes beyond the lifecycle / idempotency lookup', async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce({ valid: true, eventType: 'invoice.weird' });
    mockParseWebhookPayload.mockResolvedValueOnce({
      documentId: GUID,
      senderParticipantId: '',
      receiverParticipantId: '',
      xml: '',
      receivedAt: new Date(),
      metadata: { event: 'invoice.weird', guid: GUID },
    });

    const res = await POST(buildRequest({ event: 'invoice.weird', guid: GUID }));
    expect(res.status).toBe(200);

    expect(mockPrisma.eInvoiceLifecycle.update).not.toHaveBeenCalled();
    expect(mockPrisma.eInvoiceLifecycleEvent.create).not.toHaveBeenCalled();
  });

  it('idempotent re-delivery: same guid twice → only one event row written', async () => {
    // Second delivery: idempotency lookup returns the prior event row.
    mockPrisma.eInvoiceLifecycleEvent.findFirst.mockResolvedValueOnce({
      id: 'ev-prior',
    });

    const res = await POST(buildRequest({ event: 'invoice.transmission.success', guid: GUID }));
    expect(res.status).toBe(200);

    expect(mockPrisma.eInvoiceLifecycle.update).not.toHaveBeenCalled();
    expect(mockPrisma.eInvoiceLifecycleEvent.create).not.toHaveBeenCalled();

    const body = (await res.json()) as { idempotent?: boolean };
    expect(body.idempotent).toBe(true);
  });
});

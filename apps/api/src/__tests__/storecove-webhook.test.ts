/** @vitest-environment node */

/**
 * Storecove webhook handler tests.
 *
 * Coverage:
 *   1. Valid signature + success event → lifecycle DELIVERED + DELIVERY_ACK.
 *   2. Valid signature + failed  event → lifecycle FAILED    + DELIVERY_FAILED.
 *   3. Invalid signature → 401, no DB writes.
 *   4. Unknown event type → 200, no DB writes beyond lifecycle lookup.
 *   5. Re-delivery idempotency — same guid twice → only one event written.
 *
 * `STORECOVE_WEBHOOK_SECRET` is exported into the env in setup.ts (this
 * file's own beforeAll); the `StorecoveAdapter` is mocked so we never
 * touch real HMAC math here — that's covered by the adapter unit suite.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const GUID = 'sc-msg-guid-1';

const { mockPrisma, mockVerifyWebhookSignature, mockParseWebhookPayload } = vi.hoisted(() => {
  const prismaMock = {
    eInvoiceLifecycle: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    eInvoiceLifecycleEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  // Default tx impl — re-set inside beforeEach because clearAllMocks resets it.
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(prismaMock),
  );

  return {
    mockPrisma: prismaMock,
    mockVerifyWebhookSignature: vi.fn(),
    mockParseWebhookPayload: vi.fn(),
  };
});

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
}));

// Only the `StorecoveAdapter` constructor needs to be overridden — the
// rest of the einvoice package exposes Zod schemas + helpers consumed by
// tRPC routers loaded via packages/api, so we fall through to the real
// module for everything else.
vi.mock('@contractor-ops/einvoice', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/einvoice')>();
  return {
    ...actual,
    StorecoveAdapter: class {
      verifyWebhookSignature(body: string, headers: Record<string, string>) {
        return mockVerifyWebhookSignature(body, headers);
      }
      async parseWebhookPayload(body: string, headers: Record<string, string>) {
        return mockParseWebhookPayload(body, headers);
      }
    },
  };
});

// Imported AFTER mocks are registered so server.ts pulls the mocked
// prisma/einvoice modules.
import { __resetEnvForTests } from '../env.js';
import { buildServer } from '../server.js';

let app: FastifyInstance;

beforeAll(async () => {
  process.env.STORECOVE_WEBHOOK_SECRET = 'test-secret';
  __resetEnvForTests();
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  __resetEnvForTests();
});

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
  mockPrisma.eInvoiceLifecycleEvent.findFirst.mockResolvedValue(null);
  mockPrisma.eInvoiceLifecycle.update.mockResolvedValue(undefined);
  mockPrisma.eInvoiceLifecycleEvent.create.mockResolvedValue(undefined);
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockPrisma),
  );
});

function inject(body: unknown, headers: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: '/webhooks/storecove',
    headers: { 'content-type': 'application/json', ...headers },
    payload: JSON.stringify(body),
  });
}

describe('POST /webhooks/storecove', () => {
  it('valid signature + success event → lifecycle DELIVERED + DELIVERY_ACK event', async () => {
    const res = await inject({ event: 'invoice.transmission.success', guid: GUID });
    expect(res.statusCode).toBe(200);

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

    const res = await inject({ event: 'invoice.transmission.failed', guid: GUID });
    expect(res.statusCode).toBe(200);

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

    const res = await inject({ event: 'invoice.transmission.success', guid: GUID });
    expect(res.statusCode).toBe(401);

    expect(mockPrisma.eInvoiceLifecycle.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.eInvoiceLifecycle.update).not.toHaveBeenCalled();
    expect(mockPrisma.eInvoiceLifecycleEvent.create).not.toHaveBeenCalled();
  });

  it('unknown event type → 200, no DB writes beyond lifecycle / idempotency lookup', async () => {
    mockVerifyWebhookSignature.mockReturnValueOnce({ valid: true, eventType: 'invoice.weird' });
    mockParseWebhookPayload.mockResolvedValueOnce({
      documentId: GUID,
      senderParticipantId: '',
      receiverParticipantId: '',
      xml: '',
      receivedAt: new Date(),
      metadata: { event: 'invoice.weird', guid: GUID },
    });

    const res = await inject({ event: 'invoice.weird', guid: GUID });
    expect(res.statusCode).toBe(200);

    expect(mockPrisma.eInvoiceLifecycle.update).not.toHaveBeenCalled();
    expect(mockPrisma.eInvoiceLifecycleEvent.create).not.toHaveBeenCalled();
  });

  it('idempotent re-delivery: same guid twice → only one event row written', async () => {
    mockPrisma.eInvoiceLifecycleEvent.findFirst.mockResolvedValueOnce({ id: 'ev-prior' });

    const res = await inject({ event: 'invoice.transmission.success', guid: GUID });
    expect(res.statusCode).toBe(200);

    expect(mockPrisma.eInvoiceLifecycle.update).not.toHaveBeenCalled();
    expect(mockPrisma.eInvoiceLifecycleEvent.create).not.toHaveBeenCalled();

    const body = JSON.parse(res.body) as { idempotent?: boolean };
    expect(body.idempotent).toBe(true);
  });
});

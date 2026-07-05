/** @vitest-environment node */

/**
 * QStash drain (`/webhooks/_process`) tests.
 *
 * Coverage:
 *   1. Missing `upstash-signature` header → 401, no DB writes.
 *   2. Invalid signature → 401.
 *   3. Invalid body shape → 400.
 *   4. No adapter for provider → 404.
 *   5. Delivery row not found → 404.
 *   6. Happy path → handleWebhook invoked, status PROCESSED.
 *   7. Already PROCESSED → skipped: already-processed (no re-invoke).
 *   8. Compare-and-swap claim contention → skipped: already-claimed.
 *
 * `@upstash/qstash` `Receiver` is mocked so we don't need real signing
 * keys; the real verifier is covered by the qstash SDK's own suite.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockVerify,
  mockGetAdapter,
  mockFindUnique,
  mockUpdate,
  mockUpdateMany,
  mockIntegrationConnectionFindUnique,
  mockHandleSigningCompletion,
  mockIsSignedCopyPending,
  EsignCompletionError,
} = vi.hoisted(() => {
  class EsignCompletionError extends Error {
    retriable: boolean;
    constructor(message: string, retriable: boolean) {
      super(message);
      this.name = 'EsignCompletionError';
      this.retriable = retriable;
    }
  }
  return {
    mockVerify: vi.fn(async (_req: { signature: string; body: string; url: string }) => true),
    mockGetAdapter: vi.fn(),
    mockFindUnique: vi.fn(),
    mockUpdate: vi.fn(async () => ({})),
    mockUpdateMany: vi.fn(async () => ({ count: 1 })),
    mockIntegrationConnectionFindUnique: vi.fn(),
    mockHandleSigningCompletion: vi.fn(async () => undefined),
    mockIsSignedCopyPending: vi.fn(async () => false),
    EsignCompletionError,
  };
});

vi.mock('@upstash/qstash', () => ({
  Receiver: class {
    async verify(req: { signature: string; body: string; url: string }) {
      return mockVerify(req);
    }
  },
}));

vi.mock('@contractor-ops/integrations/adapters/register-all', () => ({
  registerAllAdapters: vi.fn(),
}));

vi.mock('@contractor-ops/integrations/registry', () => ({
  getAdapter: (...a: unknown[]) => mockGetAdapter(...a),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    webhookDelivery: {
      findUnique: (...a: unknown[]) => (mockFindUnique as (...a: unknown[]) => unknown)(...a),
      update: (...a: unknown[]) => (mockUpdate as (...a: unknown[]) => unknown)(...a),
      updateMany: (...a: unknown[]) => (mockUpdateMany as (...a: unknown[]) => unknown)(...a),
    },
    integrationConnection: {
      findUnique: (...a: unknown[]) =>
        (mockIntegrationConnectionFindUnique as (...a: unknown[]) => unknown)(...a),
    },
  },
  // Module-eval-time exports pulled in transitively via the route's import
  // graph (compliance-reminder-scan `__deps`). Stubbed so suite collection
  // doesn't crash; the drain handler under test never touches them.
  prismaRaw: {},
  getRegionalClient: () => ({}),
  SUPPORTED_REGIONS: ['EU', 'ME'],
}));

vi.mock('@contractor-ops/api/services/cron-monitor', () => ({
  withQueueObservability: <T>(_name: string, fn: () => Promise<T>) => fn(),
}));

vi.mock('@contractor-ops/api/services/esign-orchestrator', () => ({
  handleSigningCompletion: (...a: unknown[]) =>
    (mockHandleSigningCompletion as (...a: unknown[]) => unknown)(...a),
  isSignedCopyPending: (...a: unknown[]) =>
    (mockIsSignedCopyPending as (...a: unknown[]) => unknown)(...a),
  EsignCompletionError,
}));

vi.mock('@contractor-ops/api/services/resend-email-intake', () => ({
  processResendWebhookDelivery: vi.fn(async () => undefined),
}));

import { __resetEnvForTests } from '../env.js';
import { buildServer } from '../server.js';

let app: FastifyInstance;

beforeAll(async () => {
  process.env.QSTASH_CURRENT_SIGNING_KEY = 'test-current';
  process.env.QSTASH_NEXT_SIGNING_KEY = 'test-next';
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
  mockVerify.mockResolvedValue(true);
  mockGetAdapter.mockReturnValue(null);
  mockFindUnique.mockResolvedValue(null);
  mockUpdate.mockResolvedValue({});
  mockUpdateMany.mockResolvedValue({ count: 1 });
  mockIntegrationConnectionFindUnique.mockResolvedValue(null);
  mockHandleSigningCompletion.mockResolvedValue(undefined);
  mockIsSignedCopyPending.mockResolvedValue(false);
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: '/webhooks/_process',
    headers: {
      'content-type': 'application/json',
      'upstash-signature': 'sig.test',
      ...headers,
    },
    payload: JSON.stringify(body),
  });
}

describe('POST /webhooks/_process', () => {
  it('returns 401 when upstash-signature header is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/_process',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ deliveryId: 'd1', provider: 'stripe' }),
    });
    expect(res.statusCode).toBe(401);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('returns 401 when signature verification fails', async () => {
    mockVerify.mockResolvedValueOnce(false);
    const res = await post({ deliveryId: 'd1', provider: 'stripe' });
    expect(res.statusCode).toBe(401);
    expect(mockGetAdapter).not.toHaveBeenCalled();
  });

  it('returns 400 when deliveryId or provider is missing', async () => {
    const res = await post({ deliveryId: 'd1' });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toContain('Invalid');
  });

  it('returns 404 when adapter has no handleWebhook', async () => {
    mockGetAdapter.mockReturnValue({ handleWebhook: undefined });
    const res = await post({ deliveryId: 'd1', provider: 'stripe' });
    expect(res.statusCode).toBe(404);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when delivery row does not exist', async () => {
    mockGetAdapter.mockReturnValue({ handleWebhook: vi.fn(async () => undefined) });
    mockFindUnique.mockResolvedValue(null);
    const res = await post({ deliveryId: 'missing', provider: 'stripe' });
    expect(res.statusCode).toBe(404);
  });

  it('runs handleWebhook and marks delivery PROCESSED on happy path', async () => {
    const handleWebhook = vi.fn(async () => undefined);
    mockGetAdapter.mockReturnValue({ handleWebhook });
    mockFindUnique.mockResolvedValue({
      id: 'd1',
      organizationId: 'org-1',
      deliveryStatus: 'RECEIVED',
      payloadJson: { foo: 'bar' },
      integrationConnectionId: 'conn-1',
      eventType: 'invoice.paid',
    });

    const res = await post({ deliveryId: 'd1', provider: 'stripe' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { processed?: boolean };
    expect(body.processed).toBe(true);
    expect(handleWebhook).toHaveBeenCalledWith({ foo: 'bar' }, 'org-1', 'conn-1');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd1' },
        data: expect.objectContaining({ deliveryStatus: 'PROCESSED' }),
      }),
    );
  });

  it('skips re-delivery when row is already PROCESSED', async () => {
    const handleWebhook = vi.fn(async () => undefined);
    mockGetAdapter.mockReturnValue({ handleWebhook });
    mockFindUnique.mockResolvedValue({
      id: 'd1',
      organizationId: 'org-1',
      deliveryStatus: 'PROCESSED',
      payloadJson: {},
      integrationConnectionId: null,
      eventType: 'x',
    });

    const res = await post({ deliveryId: 'd1', provider: 'stripe' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { skipped?: boolean; reason?: string };
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe('already-processed');
    expect(handleWebhook).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('skips when compare-and-swap claim is contended', async () => {
    const handleWebhook = vi.fn(async () => undefined);
    mockGetAdapter.mockReturnValue({ handleWebhook });
    mockFindUnique.mockResolvedValue({
      id: 'd1',
      organizationId: 'org-1',
      deliveryStatus: 'RECEIVED',
      payloadJson: {},
      integrationConnectionId: null,
      eventType: 'x',
    });
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const res = await post({ deliveryId: 'd1', provider: 'stripe' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { skipped?: boolean; reason?: string };
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe('already-claimed');
    expect(handleWebhook).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Handler throw → FAILED, NOT lost. The 500 is the retry signal: QStash
  // re-POSTs a non-2xx up to the enqueue-configured `retries` (webhook.process
  // = 3). The CAS claim flips RECEIVED|FAILED → PROCESSING, so a FAILED row is
  // re-claimable on the next QStash attempt — the delivery is never dropped.
  // ---------------------------------------------------------------------------

  it('marks delivery FAILED and returns 500 (QStash-retryable) when handleWebhook throws', async () => {
    const handleWebhook = vi.fn(async () => {
      throw new Error('downstream Linear API 503');
    });
    mockGetAdapter.mockReturnValue({ handleWebhook });
    mockFindUnique.mockResolvedValue({
      id: 'd1',
      organizationId: 'org-1',
      deliveryStatus: 'RECEIVED',
      payloadJson: { foo: 'bar' },
      integrationConnectionId: 'conn-1',
      eventType: 'issue.update',
    });

    const res = await post({ deliveryId: 'd1', provider: 'notion' });

    // 500 — the only status that makes QStash retry. A 200 here would silently
    // drop the delivery after a single failed attempt.
    expect(res.statusCode).toBe(500);
    expect(handleWebhook).toHaveBeenCalledOnce();

    // Row is persisted FAILED with the (truncated) error, not left PROCESSING
    // (which the stale-reaper would otherwise have to rescue) and not lost.
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd1' },
        data: expect.objectContaining({
          deliveryStatus: 'FAILED',
          errorMessage: expect.stringContaining('downstream Linear API 503'),
        }),
      }),
    );
  });

  it('re-claims a FAILED row on a subsequent QStash attempt (CAS allows FAILED → PROCESSING)', async () => {
    // QStash redelivers the same deliveryId after the previous attempt 500'd.
    // The row is now FAILED; the CAS where-clause includes FAILED, so the
    // worker re-acquires it and runs the handler again — the retry is not lost.
    const handleWebhook = vi.fn(async () => undefined);
    mockGetAdapter.mockReturnValue({ handleWebhook });
    mockFindUnique.mockResolvedValue({
      id: 'd1',
      organizationId: 'org-1',
      deliveryStatus: 'FAILED',
      payloadJson: { foo: 'bar' },
      integrationConnectionId: 'conn-1',
      eventType: 'issue.update',
    });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const res = await post({ deliveryId: 'd1', provider: 'notion' });

    expect(res.statusCode).toBe(200);
    // The CAS claim targeted a FAILED row (not just RECEIVED).
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'd1',
          deliveryStatus: { in: ['RECEIVED', 'FAILED'] },
        }),
        data: { deliveryStatus: 'PROCESSING' },
      }),
    );
    expect(handleWebhook).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deliveryStatus: 'PROCESSED' }),
      }),
    );
  });

  // ---------------------------------------------------------------------------
  // E-sign completion dispatch — idempotency + retriable-vs-permanent handling.
  // ---------------------------------------------------------------------------

  function esignDelivery(status = 'RECEIVED') {
    return {
      id: 'd1',
      organizationId: 'org-1',
      deliveryStatus: status,
      payloadJson: {},
      integrationConnectionId: 'conn-1',
      eventType: 'envelope.completed',
    };
  }

  it('esign: retriable completion failure fails the delivery (500 + FAILED, NOT PROCESSED)', async () => {
    mockGetAdapter.mockReturnValue({
      handleWebhook: vi.fn(async () => ({ envelopeId: 'env-1', completed: true })),
    });
    mockFindUnique.mockResolvedValue(esignDelivery());
    mockHandleSigningCompletion.mockRejectedValueOnce(
      new EsignCompletionError('Failed to upload signed PDF to R2: 503', true),
    );

    const res = await post({ deliveryId: 'd1', provider: 'docusign' });

    expect(res.statusCode).toBe(500);
    expect(mockHandleSigningCompletion).toHaveBeenCalledWith('env-1', 'conn-1', 'DOCUSIGN');
    // FAILED, never PROCESSED — QStash re-delivers on the 500.
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: 'FAILED' }) }),
    );
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: 'PROCESSED' }) }),
    );
  });

  it('esign: permanent completion failure is swallowed (200 + PROCESSED, no retry)', async () => {
    mockGetAdapter.mockReturnValue({
      handleWebhook: vi.fn(async () => ({ envelopeId: 'env-1', completed: true })),
    });
    mockFindUnique.mockResolvedValue(esignDelivery());
    mockHandleSigningCompletion.mockRejectedValueOnce(
      new EsignCompletionError('envelope env-1 not found or missing external ID', false),
    );

    const res = await post({ deliveryId: 'd1', provider: 'docusign' });

    expect(res.statusCode).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: 'PROCESSED' }) }),
    );
  });

  it('esign: re-drives completion on retry when webhook dedups (completed=false) but copy pending', async () => {
    mockGetAdapter.mockReturnValue({
      handleWebhook: vi.fn(async () => ({ envelopeId: 'env-1', completed: false })),
    });
    mockFindUnique.mockResolvedValue(esignDelivery('FAILED'));
    mockIsSignedCopyPending.mockResolvedValueOnce(true);

    const res = await post({ deliveryId: 'd1', provider: 'docusign' });

    expect(res.statusCode).toBe(200);
    expect(mockHandleSigningCompletion).toHaveBeenCalledWith('env-1', 'conn-1', 'DOCUSIGN');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deliveryStatus: 'PROCESSED' }) }),
    );
  });

  it('esign: skips completion when webhook not completed and no signed copy is pending', async () => {
    mockGetAdapter.mockReturnValue({
      handleWebhook: vi.fn(async () => ({ envelopeId: 'env-1', completed: false })),
    });
    mockFindUnique.mockResolvedValue(esignDelivery());
    mockIsSignedCopyPending.mockResolvedValueOnce(false);

    const res = await post({ deliveryId: 'd1', provider: 'docusign' });

    expect(res.statusCode).toBe(200);
    expect(mockHandleSigningCompletion).not.toHaveBeenCalled();
  });
});

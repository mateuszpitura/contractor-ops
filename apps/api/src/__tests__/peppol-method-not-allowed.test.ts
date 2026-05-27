/** @vitest-environment node */

/**
 * GAP-WEBHOOK-003 — Peppol AS4 (Storecove) unsupported-verb handling.
 *
 * Legacy Next.js route handlers returned 405 for non-exported HTTP methods.
 * Fastify defaults to 404 for unregistered verbs on a mounted path, which
 * Peppol AS4 partner Access Points may interpret as "endpoint gone" and
 * silently stop retrying. We register explicit 405 handlers carrying the
 * RFC 7231 §6.5.5 `Allow: POST` header for every non-POST verb. POST must
 * remain wired to the real handler (signature/secret guard still runs).
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    eInvoiceLifecycle: { findFirst: vi.fn(), update: vi.fn() },
    eInvoiceLifecycleEvent: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@contractor-ops/db', () => ({ prisma: mockPrisma }));

import { __resetEnvForTests } from '../env.js';
import { buildServer } from '../server.js';

let app: FastifyInstance;

beforeAll(async () => {
  // POST handler reads STORECOVE_WEBHOOK_SECRET; not strictly required for
  // 405 verbs but matches the production env shape.
  process.env.STORECOVE_WEBHOOK_SECRET = 'test-secret';
  __resetEnvForTests();
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  __resetEnvForTests();
});

describe('Peppol AS4 (Storecove) — unsupported HTTP verbs', () => {
  for (const method of ['GET', 'PUT', 'DELETE', 'PATCH'] as const) {
    it(`${method} /webhooks/storecove → 405 + Allow: POST`, async () => {
      const res = await app.inject({ method, url: '/webhooks/storecove' });
      expect(res.statusCode).toBe(405);
      expect(res.headers.allow).toBe('POST');
    });
  }

  it('POST /webhooks/storecove still reaches handler (does not 405)', async () => {
    // No signature header → handler should respond from the signature/secret
    // guard (401 with `Invalid signature` since the test sets the secret).
    // The critical assertion is that we DO NOT fall through to the 405
    // handler — POST must remain registered for the real handler.
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/storecove',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });
    expect(res.statusCode).not.toBe(405);
    expect(res.headers.allow).toBeUndefined();
    // Real handler answers 401 (invalid signature) when secret is configured.
    expect(res.statusCode).toBe(401);
  });
});

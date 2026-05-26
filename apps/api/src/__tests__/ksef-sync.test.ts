/** @vitest-environment node */

/**
 * Smoke tests for the `/ksef/_sync` Fastify port.
 *
 * Coverage:
 *   1. Missing `upstash-signature` header → 401.
 *   2. Invalid signature → 401.
 *   3. Invalid body shape → 400.
 *   4. Happy path → `processKsefSync` invoked → 200 with `processed: true`.
 *   5. Sync error → 500.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockVerify, mockProcessKsef } = vi.hoisted(() => ({
  mockVerify: vi.fn(async (_req: { signature: string; body: string; url: string }) => true),
  mockProcessKsef: vi.fn(async () => ({ invoicesProcessed: 0, matched: 0 })),
}));

vi.mock('@upstash/qstash', () => ({
  Receiver: class {
    async verify(req: { signature: string; body: string; url: string }) {
      return mockVerify(req);
    }
  },
}));

vi.mock('@contractor-ops/api/services/ksef-sync-orchestrator', () => ({
  processKsefSync: (...a: unknown[]) => (mockProcessKsef as (...a: unknown[]) => unknown)(...a),
}));

vi.mock('@contractor-ops/api/services/cron-monitor', () => ({
  withQueueObservability: <T>(_name: string, fn: () => Promise<T>) => fn(),
}));

vi.mock('@contractor-ops/integrations/adapters/register-all', () => ({
  registerAllAdapters: vi.fn(),
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
  mockProcessKsef.mockResolvedValue({ invoicesProcessed: 0, matched: 0 });
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: '/ksef/_sync',
    headers: {
      'content-type': 'application/json',
      'upstash-signature': 'sig.test',
      ...headers,
    },
    payload: JSON.stringify(body),
  });
}

const validBody = { organizationId: 'org-1', connectionId: 'conn-1' };

describe('POST /ksef/_sync', () => {
  it('returns 401 when upstash-signature header is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ksef/_sync',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(validBody),
    });
    expect(res.statusCode).toBe(401);
    expect(mockProcessKsef).not.toHaveBeenCalled();
  });

  it('returns 401 when signature verification fails', async () => {
    mockVerify.mockResolvedValueOnce(false);
    const res = await post(validBody);
    expect(res.statusCode).toBe(401);
    expect(mockProcessKsef).not.toHaveBeenCalled();
  });

  it('returns 400 when body is missing required fields', async () => {
    const res = await post({ organizationId: 'org-1' });
    expect(res.statusCode).toBe(400);
    expect(mockProcessKsef).not.toHaveBeenCalled();
  });

  it('invokes processKsefSync on happy path', async () => {
    mockProcessKsef.mockResolvedValueOnce({ invoicesProcessed: 3, matched: 2 });
    const res = await post(validBody);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      processed?: boolean;
      invoicesProcessed?: number;
    };
    expect(body.processed).toBe(true);
    expect(body.invoicesProcessed).toBe(3);
    expect(mockProcessKsef).toHaveBeenCalledWith(validBody);
  });

  it('returns 500 on sync error', async () => {
    mockProcessKsef.mockRejectedValueOnce(new Error('neon outage'));
    const res = await post(validBody);
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body) as { error?: string };
    expect(body.error).toContain('KSeF');
  });
});

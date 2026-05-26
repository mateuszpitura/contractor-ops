/** @vitest-environment node */

/**
 * Smoke tests for the `/outbox/_drain` Fastify port.
 *
 * Coverage:
 *   1. Missing `upstash-signature` header → 401.
 *   2. Invalid signature → 401.
 *   3. Happy path → `drainOutboxBatch` invoked → 200 with result body.
 *   4. Drain throws → 500 (QStash retries).
 *
 * Body is empty for this route — the polled drain cron carries no
 * arguments. Pending-count probe is mocked to a fixed value so the
 * `queue:outbox` gauge is exercised without touching real Postgres.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockVerify, mockDrain, mockQueryRawUnsafe } = vi.hoisted(() => ({
  mockVerify: vi.fn(async (_req: { signature: string; body: string; url: string }) => true),
  mockDrain: vi.fn(async () => ({
    scanned: 0,
    dispatched: 0,
    retried: 0,
    exhausted: 0,
  })),
  mockQueryRawUnsafe: vi.fn(async () => [{ count: 0 }]),
}));

vi.mock('@upstash/qstash', () => ({
  Receiver: class {
    async verify(req: { signature: string; body: string; url: string }) {
      return mockVerify(req);
    }
  },
}));

vi.mock('@contractor-ops/api/services/outbox', () => ({
  drainOutboxBatch: (...a: unknown[]) => (mockDrain as (...a: unknown[]) => unknown)(...a),
}));

vi.mock('@contractor-ops/api/services/cron-monitor', () => ({
  withQueueObservability: <T>(_name: string, fn: () => Promise<T>) => fn(),
  recordQueueDepth: vi.fn(),
  getQueueDepthSnapshot: vi.fn(async () => []),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {},
  prismaRaw: {
    $queryRawUnsafe: (...a: unknown[]) =>
      (mockQueryRawUnsafe as (...a: unknown[]) => unknown)(...a),
  },
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
  mockDrain.mockResolvedValue({ scanned: 0, dispatched: 0, retried: 0, exhausted: 0 });
  mockQueryRawUnsafe.mockResolvedValue([{ count: 0 }]);
});

function post(headers: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: '/outbox/_drain',
    headers: {
      'content-type': 'application/json',
      'upstash-signature': 'sig.test',
      ...headers,
    },
    payload: '',
  });
}

describe('POST /outbox/_drain', () => {
  it('returns 401 when upstash-signature header is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/outbox/_drain',
      headers: { 'content-type': 'application/json' },
      payload: '',
    });
    expect(res.statusCode).toBe(401);
    expect(mockDrain).not.toHaveBeenCalled();
  });

  it('returns 401 when signature verification fails', async () => {
    mockVerify.mockResolvedValueOnce(false);
    const res = await post();
    expect(res.statusCode).toBe(401);
    expect(mockDrain).not.toHaveBeenCalled();
  });

  it('runs drainOutboxBatch and returns its result on happy path', async () => {
    mockDrain.mockResolvedValueOnce({ scanned: 5, dispatched: 4, retried: 1, exhausted: 0 });
    const res = await post();
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { scanned?: number };
    expect(body.scanned).toBe(5);
    expect(mockDrain).toHaveBeenCalled();
  });

  it('returns 500 on drain failure so QStash retries', async () => {
    mockDrain.mockRejectedValueOnce(new Error('connection refused'));
    const res = await post();
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body) as { error?: string };
    expect(body.error).toContain('drain');
  });
});

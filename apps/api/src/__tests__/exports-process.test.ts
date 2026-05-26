/** @vitest-environment node */

/**
 * Smoke tests for the `/exports/_process` Fastify port.
 *
 * Coverage:
 *   1. Missing `upstash-signature` header → 401.
 *   2. Invalid signature → 401.
 *   3. Invalid body shape → 400.
 *   4. `claimExport` throws → 500 (QStash retries).
 *   5. Row vanished → 200 + `skipped: true` (retention sweep).
 *   6. Already processed → 200 + `skipped: true`.
 *   7. Happy path → `runExportHandler` invoked → 200 + `processed: true`.
 *   8. Handler throws → 500 (QStash retries).
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockVerify, mockClaim, mockRunHandler, mockWithBackpressure } = vi.hoisted(() => ({
  mockVerify: vi.fn(async (_req: { signature: string; body: string; url: string }) => true),
  mockClaim: vi.fn(),
  mockRunHandler: vi.fn(async () => undefined),
  mockWithBackpressure: vi.fn(async (_key: string, _max: number, fn: () => Promise<unknown>) =>
    fn(),
  ),
}));

vi.mock('@upstash/qstash', () => ({
  Receiver: class {
    async verify(req: { signature: string; body: string; url: string }) {
      return mockVerify(req);
    }
  },
}));

vi.mock('@contractor-ops/api/services/exports', () => ({
  claimExport: (...a: unknown[]) => (mockClaim as (...a: unknown[]) => unknown)(...a),
  runExportHandler: (...a: unknown[]) => (mockRunHandler as (...a: unknown[]) => unknown)(...a),
}));

vi.mock('@contractor-ops/api/services/cron-monitor', () => ({
  withQueueObservability: <T>(_name: string, fn: () => Promise<T>) => fn(),
}));

vi.mock('@contractor-ops/api/services/qstash-backpressure', () => ({
  BackpressureRoutes: {
    EXPORTS_PROCESS: { key: 'exports-process', max: 5 },
    OCR_PROCESS: { key: 'ocr-process', max: 10 },
    PEPPOL_OUTBOUND: { key: 'peppol-outbound', max: 5 },
    LATE_INTEREST_RENDER: { key: 'late-interest-render', max: 5 },
  },
  isBackpressureRejected: () => false,
  withBackpressure: (...a: unknown[]) =>
    (mockWithBackpressure as (...a: unknown[]) => unknown)(...a),
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
  mockClaim.mockResolvedValue({ id: 'ex-1', alreadyProcessed: false });
  mockRunHandler.mockResolvedValue(undefined);
  mockWithBackpressure.mockImplementation(async (_k, _m, fn: () => Promise<unknown>) => fn());
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: '/exports/_process',
    headers: {
      'content-type': 'application/json',
      'upstash-signature': 'sig.test',
      ...headers,
    },
    payload: JSON.stringify(body),
  });
}

const validBody = { exportId: 'ex-1', organizationId: 'org-1' };

describe('POST /exports/_process', () => {
  it('returns 401 when upstash-signature header is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/exports/_process',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(validBody),
    });
    expect(res.statusCode).toBe(401);
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it('returns 401 when signature verification fails', async () => {
    mockVerify.mockResolvedValueOnce(false);
    const res = await post(validBody);
    expect(res.statusCode).toBe(401);
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it('returns 400 when body is missing required fields', async () => {
    const res = await post({ exportId: 'ex-1' });
    expect(res.statusCode).toBe(400);
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it('returns 500 when claimExport throws (QStash retries)', async () => {
    mockClaim.mockRejectedValueOnce(new Error('neon hiccup'));
    const res = await post(validBody);
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body) as { error?: string };
    expect(body.error).toContain('claim');
  });

  it('skips when export row vanished (retention sweep)', async () => {
    mockClaim.mockResolvedValueOnce(null);
    const res = await post(validBody);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { skipped?: boolean };
    expect(body.skipped).toBe(true);
    expect(mockRunHandler).not.toHaveBeenCalled();
  });

  it('skips when export already processed', async () => {
    mockClaim.mockResolvedValueOnce({ id: 'ex-1', alreadyProcessed: true });
    const res = await post(validBody);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { skipped?: boolean };
    expect(body.skipped).toBe(true);
    expect(mockRunHandler).not.toHaveBeenCalled();
  });

  it('invokes runExportHandler on happy path', async () => {
    const res = await post(validBody);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { processed?: boolean };
    expect(body.processed).toBe(true);
    expect(mockRunHandler).toHaveBeenCalled();
  });

  it('returns 500 when handler throws (QStash retries)', async () => {
    mockRunHandler.mockRejectedValueOnce(new Error('r2 timeout'));
    const res = await post(validBody);
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body) as { error?: string };
    expect(body.error).toContain('handler');
  });
});

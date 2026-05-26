/** @vitest-environment node */

/**
 * Smoke tests for the `/ocr/_process` Fastify port.
 *
 * Coverage:
 *   1. Missing `upstash-signature` header → 401.
 *   2. Invalid signature → 401.
 *   3. Invalid body shape → 400.
 *   4. Happy path → `processOcrExtraction` invoked → 200.
 *   5. Permanent error (`invalid pdf`) → 200 + classification:permanent
 *      (QStash drops; Sentry captured).
 *   6. Transient error (default) → 500 + classification:transient
 *      (QStash retries).
 *
 * `@upstash/qstash` Receiver + service handler + backpressure helper are
 * mocked so the Fastify route plumbing runs end-to-end without touching
 * real Upstash, Anthropic, or R2.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockVerify, mockProcessOcr, mockWithBackpressure } = vi.hoisted(() => ({
  mockVerify: vi.fn(async (_req: { signature: string; body: string; url: string }) => true),
  mockProcessOcr: vi.fn(async () => undefined),
  // Bypass backpressure semaphore in tests — the real wrapper just calls fn().
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

vi.mock('@contractor-ops/api/services/ocr-extraction', () => ({
  processOcrExtraction: (...a: unknown[]) => (mockProcessOcr as (...a: unknown[]) => unknown)(...a),
}));

vi.mock('@contractor-ops/api/services/cron-monitor', () => ({
  withQueueObservability: <T>(_name: string, fn: () => Promise<T>) => fn(),
}));

vi.mock('@contractor-ops/api/services/qstash-backpressure', () => ({
  BackpressureRoutes: {
    OCR_PROCESS: { key: 'ocr-process', max: 10 },
    PEPPOL_OUTBOUND: { key: 'peppol-outbound', max: 5 },
    EXPORTS_PROCESS: { key: 'exports-process', max: 5 },
    LATE_INTEREST_RENDER: { key: 'late-interest-render', max: 5 },
  },
  isBackpressureRejected: () => false,
  withBackpressure: (...a: unknown[]) =>
    (mockWithBackpressure as (...a: unknown[]) => unknown)(...a),
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
  mockProcessOcr.mockResolvedValue(undefined);
  mockWithBackpressure.mockImplementation(async (_k, _m, fn: () => Promise<unknown>) => fn());
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: '/ocr/_process',
    headers: {
      'content-type': 'application/json',
      'upstash-signature': 'sig.test',
      ...headers,
    },
    payload: JSON.stringify(body),
  });
}

const validBody = {
  extractionId: 'ex-1',
  organizationId: 'org-1',
  storageKey: 'uploads/ex-1.pdf',
};

describe('POST /ocr/_process', () => {
  it('returns 401 when upstash-signature header is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ocr/_process',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(validBody),
    });
    expect(res.statusCode).toBe(401);
    expect(mockProcessOcr).not.toHaveBeenCalled();
  });

  it('returns 401 when signature verification fails', async () => {
    mockVerify.mockResolvedValueOnce(false);
    const res = await post(validBody);
    expect(res.statusCode).toBe(401);
    expect(mockProcessOcr).not.toHaveBeenCalled();
  });

  it('returns 400 when body is missing required fields', async () => {
    const res = await post({ extractionId: 'ex-1' });
    expect(res.statusCode).toBe(400);
    expect(mockProcessOcr).not.toHaveBeenCalled();
  });

  it('invokes processOcrExtraction on the happy path', async () => {
    const res = await post(validBody);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { processed?: boolean };
    expect(body.processed).toBe(true);
    expect(mockProcessOcr).toHaveBeenCalledWith(validBody);
  });

  it('classifies permanent OCR errors as 200 + permanent (QStash drops)', async () => {
    mockProcessOcr.mockRejectedValueOnce(new Error('Invalid PDF file'));
    const res = await post(validBody);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { classification?: string };
    expect(body.classification).toBe('permanent');
  });

  it('classifies transient errors as 500 (QStash retries)', async () => {
    mockProcessOcr.mockRejectedValueOnce(new Error('Anthropic 503 service unavailable'));
    const res = await post(validBody);
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body) as { classification?: string };
    expect(body.classification).toBe('transient');
  });
});

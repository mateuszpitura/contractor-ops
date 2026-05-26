/** @vitest-environment node */

/**
 * Smoke tests for the `/late-interest/_render-claim-pdf` Fastify port.
 *
 * Coverage:
 *   1. Missing `upstash-signature` header → 401.
 *   2. Invalid signature → 401.
 *   3. Invalid body shape → 400.
 *   4. Happy path → `renderClaimPdf` invoked → 200 + `processed: true`.
 *   5. Render error → 500 (QStash retries).
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockVerify, mockRenderClaim, mockWithBackpressure } = vi.hoisted(() => ({
  mockVerify: vi.fn(async (_req: { signature: string; body: string; url: string }) => true),
  mockRenderClaim: vi.fn(async () => ({ pdfKey: 'r2://claims/test.pdf' })),
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

vi.mock('@contractor-ops/api/services/late-payment-claim-pdf', () => ({
  renderClaimPdf: (...a: unknown[]) => (mockRenderClaim as (...a: unknown[]) => unknown)(...a),
}));

vi.mock('@contractor-ops/api/services/cron-monitor', () => ({
  withQueueObservability: <T>(_name: string, fn: () => Promise<T>) => fn(),
}));

vi.mock('@contractor-ops/api/services/qstash-backpressure', () => ({
  BackpressureRoutes: {
    LATE_INTEREST_RENDER: { key: 'late-interest-render', max: 5 },
    OCR_PROCESS: { key: 'ocr-process', max: 10 },
    PEPPOL_OUTBOUND: { key: 'peppol-outbound', max: 5 },
    EXPORTS_PROCESS: { key: 'exports-process', max: 5 },
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
  mockRenderClaim.mockResolvedValue({ pdfKey: 'r2://claims/test.pdf' });
  mockWithBackpressure.mockImplementation(async (_k, _m, fn: () => Promise<unknown>) => fn());
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: '/late-interest/_render-claim-pdf',
    headers: {
      'content-type': 'application/json',
      'upstash-signature': 'sig.test',
      ...headers,
    },
    payload: JSON.stringify(body),
  });
}

const validBody = { claimId: 'claim-1', organizationId: 'org-1' };

describe('POST /late-interest/_render-claim-pdf', () => {
  it('returns 401 when upstash-signature header is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/late-interest/_render-claim-pdf',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(validBody),
    });
    expect(res.statusCode).toBe(401);
    expect(mockRenderClaim).not.toHaveBeenCalled();
  });

  it('returns 401 when signature verification fails', async () => {
    mockVerify.mockResolvedValueOnce(false);
    const res = await post(validBody);
    expect(res.statusCode).toBe(401);
    expect(mockRenderClaim).not.toHaveBeenCalled();
  });

  it('returns 400 when body is missing required fields', async () => {
    const res = await post({ claimId: 'claim-1' });
    expect(res.statusCode).toBe(400);
    expect(mockRenderClaim).not.toHaveBeenCalled();
  });

  it('invokes renderClaimPdf on happy path', async () => {
    const res = await post(validBody);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { processed?: boolean; pdfKey?: string };
    expect(body.processed).toBe(true);
    expect(body.pdfKey).toBe('r2://claims/test.pdf');
    expect(mockRenderClaim).toHaveBeenCalledWith('claim-1');
  });

  it('returns 500 on render error', async () => {
    mockRenderClaim.mockRejectedValueOnce(new Error('react-pdf OOM'));
    const res = await post(validBody);
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body) as { error?: string };
    expect(body.error).toContain('render');
  });
});

/** @vitest-environment node */

/**
 * Smoke tests for the `/zatca/_submit` Fastify port.
 *
 * Coverage:
 *   1. Missing `upstash-signature` header → 401.
 *   2. Invalid signature → 401.
 *   3. Invalid body shape → 400.
 *   4. Existing submitted chain row → 200 + `skipped: true`.
 *   5. Happy path → `handleZatcaSubmissionJob` invoked → 200 + `submitted: true`.
 *   6. `ZatcaApiError` thrown → 500 + `errorType` field (QStash retries).
 *   7. Generic error thrown → 500 (QStash retries).
 *
 * `@upstash/qstash` Receiver + service handler are mocked so we exercise
 * the Fastify route plumbing without touching real Upstash or ZATCA.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockVerify, mockHandleJob, mockChainFindUnique } = vi.hoisted(() => ({
  mockVerify: vi.fn(async (_req: { signature: string; body: string; url: string }) => true),
  mockHandleJob: vi.fn(async () => undefined),
  mockChainFindUnique: vi.fn(),
}));

vi.mock('@upstash/qstash', () => ({
  Receiver: class {
    async verify(req: { signature: string; body: string; url: string }) {
      return mockVerify(req);
    }
  },
}));

vi.mock('@contractor-ops/api/services/zatca-submission', () => ({
  handleZatcaSubmissionJob: (...a: unknown[]) =>
    (mockHandleJob as (...a: unknown[]) => unknown)(...a),
}));

vi.mock('@contractor-ops/api/services/cron-monitor', () => ({
  withQueueObservability: <T>(_name: string, fn: () => Promise<T>) => fn(),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    zatcaInvoiceChain: {
      findUnique: (...a: unknown[]) => (mockChainFindUnique as (...a: unknown[]) => unknown)(...a),
    },
  },
  prismaRaw: {},
  getRegionalClient: () => ({}),
  SUPPORTED_REGIONS: ['EU', 'ME', 'US'],
}));

// `ZatcaApiError` is a real export — we want the actual constructor so
// `error instanceof ZatcaApiError` works inside the route.
const { ZatcaApiError } = await vi.importActual<typeof import('@contractor-ops/einvoice')>(
  '@contractor-ops/einvoice',
);

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
  mockChainFindUnique.mockResolvedValue(null);
  mockHandleJob.mockResolvedValue(undefined);
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: '/zatca/_submit',
    headers: {
      'content-type': 'application/json',
      'upstash-signature': 'sig.test',
      ...headers,
    },
    payload: JSON.stringify(body),
  });
}

describe('POST /zatca/_submit', () => {
  it('returns 401 when upstash-signature header is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/zatca/_submit',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ invoiceId: 'inv-1', organizationId: 'org-1' }),
    });
    expect(res.statusCode).toBe(401);
    expect(mockHandleJob).not.toHaveBeenCalled();
  });

  it('returns 401 when signature verification fails', async () => {
    mockVerify.mockResolvedValueOnce(false);
    const res = await post({ invoiceId: 'inv-1', organizationId: 'org-1' });
    expect(res.statusCode).toBe(401);
    expect(mockHandleJob).not.toHaveBeenCalled();
  });

  it('returns 400 when body is missing required fields', async () => {
    const res = await post({ invoiceId: 'inv-1' });
    expect(res.statusCode).toBe(400);
    expect(mockHandleJob).not.toHaveBeenCalled();
  });

  it('short-circuits when a chain row already records submission', async () => {
    mockChainFindUnique.mockResolvedValue({ submittedAt: new Date(), zatcaStatus: 'ACCEPTED' });
    const res = await post({ invoiceId: 'inv-1', organizationId: 'org-1' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { skipped?: boolean; status?: string };
    expect(body.skipped).toBe(true);
    expect(body.status).toBe('ACCEPTED');
    expect(mockHandleJob).not.toHaveBeenCalled();
  });

  it('calls handleZatcaSubmissionJob on happy path', async () => {
    const res = await post({ invoiceId: 'inv-1', organizationId: 'org-1', attempt: 2 });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { submitted?: boolean };
    expect(body.submitted).toBe(true);
    expect(mockHandleJob).toHaveBeenCalledWith({
      invoiceId: 'inv-1',
      organizationId: 'org-1',
      attempt: 2,
    });
  });

  it('returns 500 + errorType on ZatcaApiError', async () => {
    mockHandleJob.mockRejectedValueOnce(
      new ZatcaApiError('upstream blew up', 502, 'TRANSIENT' as never, ''),
    );
    const res = await post({ invoiceId: 'inv-1', organizationId: 'org-1' });
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body) as { error?: string; errorType?: string };
    expect(body.error).toContain('retryable');
    expect(body.errorType).toBe('TRANSIENT');
  });

  it('returns 500 on generic errors so QStash retries', async () => {
    mockHandleJob.mockRejectedValueOnce(new Error('boom'));
    const res = await post({ invoiceId: 'inv-1', organizationId: 'org-1' });
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body) as { error?: string };
    expect(body.error).toContain('failed');
  });
});

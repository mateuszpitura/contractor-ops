/** @vitest-environment node */

/**
 * Smoke tests for the `/peppol/outbound` Fastify port.
 *
 * Coverage:
 *   1. Missing `upstash-signature` header → 401.
 *   2. Invalid signature → 401.
 *   3. Invalid body shape → 400.
 *   4. No PEPPOL connection → 200 + soft error (QStash drops).
 *   5. Happy path → orchestrator invoked → 200 + transmission id.
 *   6. Permanent error (validation) → 200 + classification:permanent.
 *   7. Transient error (5xx) → 500 + classification:transient (retries).
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockVerify,
  mockConnectionFindFirst,
  mockGetCredentials,
  mockSubmitOutbound,
  mockWithBackpressure,
} = vi.hoisted(() => ({
  mockVerify: vi.fn(async (_req: { signature: string; body: string; url: string }) => true),
  mockConnectionFindFirst: vi.fn(),
  mockGetCredentials: vi.fn(async () => ({ accessToken: 'tok' })),
  mockSubmitOutbound: vi.fn(async (_arg: unknown) => ({ id: 'tx-1' })),
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

vi.mock('@contractor-ops/api/services/cron-monitor', () => ({
  recordQueueDepth: vi.fn(),
  withQueueObservability: <T>(_name: string, fn: () => Promise<T>) => fn(),
}));

vi.mock('@contractor-ops/api/services/qstash-backpressure', () => ({
  BackpressureRoutes: {
    PEPPOL_OUTBOUND: { key: 'peppol-outbound', max: 5 },
    OCR_PROCESS: { key: 'ocr-process', max: 10 },
    EXPORTS_PROCESS: { key: 'exports-process', max: 5 },
    LATE_INTEREST_RENDER: { key: 'late-interest-render', max: 5 },
  },
  isBackpressureRejected: () => false,
  withBackpressure: (...a: unknown[]) =>
    (mockWithBackpressure as (...a: unknown[]) => unknown)(...a),
}));

vi.mock('@contractor-ops/api/services/peppol-orchestrator', () => ({
  PeppolOrchestrator: class {
    submitOutboundInvoice(arg: unknown) {
      return mockSubmitOutbound(arg);
    }
  },
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    integrationConnection: {
      findFirst: (...a: unknown[]) =>
        (mockConnectionFindFirst as (...a: unknown[]) => unknown)(...a),
      update: vi.fn(async () => ({})),
    },
    peppolParticipant: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock('@contractor-ops/integrations', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/integrations')>();
  return {
    ...actual,
    getCredentials: (...a: unknown[]) => (mockGetCredentials as (...a: unknown[]) => unknown)(...a),
  };
});

vi.mock('@contractor-ops/einvoice', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/einvoice')>();
  return {
    ...actual,
    StorecoveAdapter: class {},
  };
});

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
  mockConnectionFindFirst.mockResolvedValue({
    id: 'conn-1',
    credentialsRef: 'ref',
    configJson: { environment: 'sandbox' },
  });
  mockGetCredentials.mockResolvedValue({ accessToken: 'tok' });
  mockSubmitOutbound.mockResolvedValue({ id: 'tx-1' });
  mockWithBackpressure.mockImplementation(async (_k, _m, fn: () => Promise<unknown>) => fn());
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: '/peppol/outbound',
    headers: {
      'content-type': 'application/json',
      'upstash-signature': 'sig.test',
      ...headers,
    },
    payload: JSON.stringify(body),
  });
}

const validBody = {
  organizationId: 'org-1',
  invoiceId: 'inv-1',
  receiverParticipantId: 'p-1',
};

describe('POST /peppol/outbound', () => {
  it('returns 401 when upstash-signature header is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/peppol/outbound',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(validBody),
    });
    expect(res.statusCode).toBe(401);
    expect(mockSubmitOutbound).not.toHaveBeenCalled();
  });

  it('returns 401 when signature verification fails', async () => {
    mockVerify.mockResolvedValueOnce(false);
    const res = await post(validBody);
    expect(res.statusCode).toBe(401);
    expect(mockSubmitOutbound).not.toHaveBeenCalled();
  });

  it('returns 400 when body is missing required fields', async () => {
    const res = await post({ organizationId: 'org-1' });
    expect(res.statusCode).toBe(400);
    expect(mockSubmitOutbound).not.toHaveBeenCalled();
  });

  it('returns 200 with soft error when no active PEPPOL connection', async () => {
    mockConnectionFindFirst.mockResolvedValueOnce(null);
    const res = await post(validBody);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { error?: string };
    expect(body.error).toContain('No Peppol connection');
    expect(mockSubmitOutbound).not.toHaveBeenCalled();
  });

  it('returns 200 + transmission id on happy path', async () => {
    const res = await post(validBody);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { processed?: boolean; transmissionId?: string };
    expect(body.processed).toBe(true);
    expect(body.transmissionId).toBe('tx-1');
  });

  it('classifies permanent errors as 200 + permanent (QStash drops)', async () => {
    mockSubmitOutbound.mockRejectedValueOnce(new Error('invalid xml'));
    const res = await post(validBody);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { classification?: string };
    expect(body.classification).toBe('permanent');
  });

  it('classifies transient errors as 500 + transient (QStash retries)', async () => {
    mockSubmitOutbound.mockRejectedValueOnce(new Error('storecove 503 service unavailable'));
    const res = await post(validBody);
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body) as { classification?: string };
    expect(body.classification).toBe('transient');
  });
});

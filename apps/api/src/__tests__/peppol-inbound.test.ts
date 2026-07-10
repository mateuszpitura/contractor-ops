/** @vitest-environment node */

/**
 * Smoke tests for the `/peppol/inbound` Fastify port.
 *
 * Coverage:
 *   1. Missing `upstash-signature` header → 401.
 *   2. Invalid signature → 401.
 *   3. Invalid body shape → 400.
 *   4. No PEPPOL connection → 200 + soft error (QStash drops, ops sees row).
 *   5. Happy path → orchestrator invoked → delivery flipped to PROCESSED.
 *   6. Orchestrator throws → 500 + delivery flipped to FAILED.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockVerify,
  mockDeliveryFindUniqueOrThrow,
  mockDeliveryUpdate,
  mockConnectionFindFirst,
  mockGetCredentials,
  mockProcessInbound,
  mockParseWebhookPayload,
} = vi.hoisted(() => ({
  mockVerify: vi.fn(async (_req: { signature: string; body: string; url: string }) => true),
  mockDeliveryFindUniqueOrThrow: vi.fn(),
  mockDeliveryUpdate: vi.fn(async () => ({})),
  mockConnectionFindFirst: vi.fn(),
  mockGetCredentials: vi.fn(async () => ({ accessToken: 'tok' })),
  mockProcessInbound: vi.fn(async (_arg: unknown) => ({ invoice: { id: 'inv-1' } })),
  mockParseWebhookPayload: vi.fn(async (_body: string, _headers: Record<string, string>) => ({})),
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

vi.mock('@contractor-ops/api/services/peppol-orchestrator', () => ({
  PeppolOrchestrator: class {
    processInboundInvoice(arg: unknown) {
      return mockProcessInbound(arg);
    }
  },
}));

vi.mock('@contractor-ops/db', () => {
  const prismaMock = {
    webhookDelivery: {
      findUnique: (...a: unknown[]) =>
        (mockDeliveryFindUniqueOrThrow as (...a: unknown[]) => unknown)(...a),
      findUniqueOrThrow: (...a: unknown[]) =>
        (mockDeliveryFindUniqueOrThrow as (...a: unknown[]) => unknown)(...a),
      update: (...a: unknown[]) => (mockDeliveryUpdate as (...a: unknown[]) => unknown)(...a),
    },
    integrationConnection: {
      findFirst: (...a: unknown[]) =>
        (mockConnectionFindFirst as (...a: unknown[]) => unknown)(...a),
    },
    peppolParticipant: { findMany: vi.fn(async () => []) },
    organization: {
      findUnique: vi.fn(async (_args: unknown) => ({ dataRegion: 'EU' })),
    },
  };
  // Single-region mirror of packages/db/src/region.ts: every helper resolves
  // to the one mocked client so route handlers exercise the same seams.
  const findAcrossRegions = async (
    finder: (client: typeof prismaMock, region: string) => Promise<unknown>,
  ) => {
    const result = await finder(prismaMock, 'EU');
    return result == null ? null : { result, region: 'EU', client: prismaMock };
  };
  return {
    prisma: prismaMock,
    prismaRaw: {},
    getRegionalClient: () => prismaMock,
    tryGetRegionalClient: () => prismaMock,
    SUPPORTED_REGIONS: ['EU'],
    findAcrossRegions,
    resolveOrganizationRegion: async (organizationId: string) =>
      findAcrossRegions(async client => {
        const org = await client.organization.findUnique({
          where: { id: organizationId },
          select: { dataRegion: true },
        });
        return org == null ? null : (org.dataRegion ?? 'EU');
      }),
  };
});

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
    StorecoveAdapter: class {
      async parseWebhookPayload(body: string, headers: Record<string, string>) {
        return mockParseWebhookPayload(body, headers);
      }
    },
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
  mockDeliveryFindUniqueOrThrow.mockResolvedValue({
    id: 'del-1',
    organizationId: 'org-1',
    payloadJson: { foo: 'bar' },
  });
  mockDeliveryUpdate.mockResolvedValue({});
  mockConnectionFindFirst.mockResolvedValue({
    id: 'conn-1',
    credentialsRef: 'ref',
    configJson: { environment: 'sandbox' },
  });
  mockGetCredentials.mockResolvedValue({ accessToken: 'tok' });
  mockProcessInbound.mockResolvedValue({ invoice: { id: 'inv-1' } });
  mockParseWebhookPayload.mockResolvedValue({});
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: '/peppol/inbound',
    headers: {
      'content-type': 'application/json',
      'upstash-signature': 'sig.test',
      ...headers,
    },
    payload: JSON.stringify(body),
  });
}

const validBody = { deliveryId: 'del-1', organizationId: 'org-1' };

describe('POST /peppol/inbound', () => {
  it('returns 401 when upstash-signature header is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/peppol/inbound',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(validBody),
    });
    expect(res.statusCode).toBe(401);
    expect(mockProcessInbound).not.toHaveBeenCalled();
  });

  it('returns 401 when signature verification fails', async () => {
    mockVerify.mockResolvedValueOnce(false);
    const res = await post(validBody);
    expect(res.statusCode).toBe(401);
    expect(mockProcessInbound).not.toHaveBeenCalled();
  });

  it('returns 400 when body is missing required fields', async () => {
    const res = await post({ deliveryId: 'del-1' });
    expect(res.statusCode).toBe(400);
    expect(mockProcessInbound).not.toHaveBeenCalled();
  });

  it('returns 200 with soft error when no active PEPPOL connection', async () => {
    mockConnectionFindFirst.mockResolvedValueOnce(null);
    const res = await post(validBody);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { error?: string };
    expect(body.error).toContain('No Peppol connection');
    expect(mockProcessInbound).not.toHaveBeenCalled();
  });

  it('flips delivery to PROCESSED on happy path', async () => {
    const res = await post(validBody);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { processed?: boolean; invoiceId?: string };
    expect(body.processed).toBe(true);
    expect(body.invoiceId).toBe('inv-1');
    expect(mockDeliveryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'del-1' },
        data: expect.objectContaining({ deliveryStatus: 'PROCESSED' }),
      }),
    );
  });

  it('returns 500 + flips delivery to FAILED on orchestrator throw', async () => {
    mockProcessInbound.mockRejectedValueOnce(new Error('storecove 500'));
    const res = await post(validBody);
    expect(res.statusCode).toBe(500);
    expect(mockDeliveryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'del-1' },
        data: expect.objectContaining({ deliveryStatus: 'FAILED' }),
      }),
    );
  });
});

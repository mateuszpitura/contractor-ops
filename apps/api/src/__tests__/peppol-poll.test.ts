/** @vitest-environment node */

/**
 * Smoke tests for the `/peppol/poll` Fastify port.
 *
 * Coverage:
 *   1. Missing `upstash-signature` header → 401.
 *   2. Invalid signature → 401.
 *   3. Empty body → polls every active PEPPOL participant.
 *   4. Body with `organizationId` → polls only that participant.
 *   5. Global error → 500.
 *
 * The Peppol orchestrator + Prisma client are mocked so the route
 * plumbing runs without touching real Storecove or Neon.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockVerify,
  mockParticipantFindMany,
  mockConnectionFindFirst,
  mockConnectionUpdate,
  mockGetCredentials,
  mockPollAndProcess,
} = vi.hoisted(() => ({
  mockVerify: vi.fn(async (_req: { signature: string; body: string; url: string }) => true),
  mockParticipantFindMany: vi.fn(async () => [] as Array<{ organizationId: string }>),
  mockConnectionFindFirst: vi.fn(),
  mockConnectionUpdate: vi.fn(async () => ({})),
  mockGetCredentials: vi.fn(async () => ({ accessToken: 'token-1' })),
  mockPollAndProcess: vi.fn(async (_organizationId: string) => 0),
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
    pollAndProcessInbound(organizationId: string) {
      return mockPollAndProcess(organizationId);
    }
  },
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    peppolParticipant: {
      findMany: (...a: unknown[]) =>
        (mockParticipantFindMany as (...a: unknown[]) => unknown)(...a),
    },
    integrationConnection: {
      findFirst: (...a: unknown[]) =>
        (mockConnectionFindFirst as (...a: unknown[]) => unknown)(...a),
      findMany: vi.fn(async () => []),
      update: (...a: unknown[]) => (mockConnectionUpdate as (...a: unknown[]) => unknown)(...a),
    },
  },
  prismaRaw: {},
  getRegionalClient: () => ({}),
  SUPPORTED_REGIONS: ['EU', 'ME', 'US'],
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
    StorecoveAdapter: class {
      // No-op stub — the route only passes this to PeppolOrchestrator,
      // which we already replaced above.
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
  mockParticipantFindMany.mockResolvedValue([]);
  mockConnectionFindFirst.mockResolvedValue({
    id: 'conn-1',
    credentialsRef: 'ref',
    configJson: { environment: 'sandbox' },
  });
  mockGetCredentials.mockResolvedValue({ accessToken: 'token-1' });
  mockPollAndProcess.mockResolvedValue(3);
  mockConnectionUpdate.mockResolvedValue({});
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: '/peppol/poll',
    headers: {
      'content-type': 'application/json',
      'upstash-signature': 'sig.test',
      ...headers,
    },
    payload: JSON.stringify(body),
  });
}

describe('POST /peppol/poll', () => {
  it('returns 401 when upstash-signature header is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/peppol/poll',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({}),
    });
    expect(res.statusCode).toBe(401);
    expect(mockParticipantFindMany).not.toHaveBeenCalled();
  });

  it('returns 401 when signature verification fails', async () => {
    mockVerify.mockResolvedValueOnce(false);
    const res = await post({});
    expect(res.statusCode).toBe(401);
    expect(mockParticipantFindMany).not.toHaveBeenCalled();
  });

  it('sweeps all ACTIVE participants when body is empty', async () => {
    mockParticipantFindMany.mockResolvedValueOnce([
      { organizationId: 'org-a' },
      { organizationId: 'org-b' },
    ]);
    const res = await post({});
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { polled?: number; results?: unknown[] };
    expect(body.polled).toBe(2);
    expect(mockParticipantFindMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE' },
      select: { organizationId: true },
    });
    expect(mockPollAndProcess).toHaveBeenCalledTimes(2);
  });

  it('targets a single org when organizationId is provided', async () => {
    mockParticipantFindMany.mockResolvedValueOnce([{ organizationId: 'org-1' }]);
    const res = await post({ organizationId: 'org-1' });
    expect(res.statusCode).toBe(200);
    expect(mockParticipantFindMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', status: 'ACTIVE' },
      select: { organizationId: true },
    });
    expect(mockPollAndProcess).toHaveBeenCalledWith('org-1');
  });

  it('returns 500 when the participant query throws', async () => {
    mockParticipantFindMany.mockRejectedValueOnce(new Error('neon timeout'));
    const res = await post({});
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body) as { error?: string };
    expect(body.error).toContain('Poll failed');
  });
});

/**
 * Key rotation with a grace window.
 *
 * `rotate` issues a NEW `co_live_*` key inheriting the old key's name/scopes/
 * actingUserId, marks the OLD key superseded with a bounded grace window, and
 * audits `API_KEY_ROTATE`. During the grace window the OLD key still resolves;
 * after `graceExpiresAt` it hard-stops. A revoked key never resolves (revocation
 * wins). A superseded key cannot be rotated again (single grace chain).
 *
 * NOTE: `resolveByPrefix` filters at the DB `where` level, so the grace behavior
 * is asserted structurally (the query must admit superseded-within-grace keys
 * and still exclude revoked ones) rather than by simulating Prisma filtering.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-rotate-001';
const CREATOR_ID = 'user-rotate-creator-001';
const KEY_ID = 'key-rotate-001';

const { mockPrisma, evaluateMock } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;
  const mockPrisma: Rec = {
    auditLog: {
      create: vi.fn(async () => ({ id: 'audit-1' })),
      createMany: vi.fn(async () => ({ count: 1 })),
    },
    organizationApiKey: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (args: { data: Rec }) => ({ id: 'new-key', ...args.data })),
      update: vi.fn(async (args: { data: Rec }) => ({ id: KEY_ID, ...args.data })),
      count: vi.fn(async () => 0),
    },
    member: { findFirst: vi.fn(async () => ({ id: 'm-1', role: 'admin', disabledAt: null })) },
    organization: {
      findUnique: vi.fn(async () => ({ id: 'org-rotate-001', dataRegion: 'EU', status: 'ACTIVE' })),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };
  return { mockPrisma, evaluateMock: vi.fn(() => ({ enabled: true, reason: 'unleash' })) };
});

vi.mock('@contractor-ops/feature-flags', () => ({ evaluate: evaluateMock }));

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: vi.fn().mockResolvedValue({ success: true }) },
  },
  authApi: {
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
    getSession: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@contractor-ops/db', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/db')>();
  return {
    ...actual,
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
    prisma: mockPrisma,
    prismaRaw: mockPrisma,
    tenantStore: {
      run: (_c: unknown, fn: () => unknown) => fn(),
      getStore: vi.fn(() => ({ region: 'EU' })),
    },
    withTenantScope: vi.fn((c: unknown) => c),
    withSoftDelete: vi.fn((c: unknown) => c),
    createTenantClient: vi.fn(() => mockPrisma),
    createTenantClientFrom: vi.fn(() => mockPrisma),
    getRegionalClient: vi.fn(() => mockPrisma),
    tryGetRegionalClient: vi.fn(() => mockPrisma),
  };
});

vi.mock('../../services/billing-service', () => ({
  getSubscription: vi.fn(async () => ({ id: 'sub_1', status: 'ACTIVE', tier: 'ENTERPRISE' })),
}));

vi.mock('../../services/org-cache', () => ({
  getOrgMeta: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })),
  invalidateOrgBranding: vi.fn(async () => undefined),
  invalidateOrgMeta: vi.fn(async () => undefined),
}));

vi.mock('../../services/cache', async importOriginal => {
  const actual = await importOriginal<typeof import('../../services/cache')>();
  const { createPassthroughCacheMock } = await import('../../__tests__/__mocks__/cache-service');
  return createPassthroughCacheMock(actual);
});

vi.mock('@contractor-ops/logger', () => {
  const stub = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return {
    createLogger: vi.fn(() => ({ ...stub, child: vi.fn(() => stub) })),
    createTrpcLogger: vi.fn(() => stub),
    createCronLogger: vi.fn(() => stub),
    createWebhookLogger: vi.fn(() => stub),
    createIntegrationLogger: vi.fn(() => stub),
    getIdpAuditLogger: vi.fn(() => ({ ...stub, child: vi.fn() })),
    withBodyLogging: vi.fn((_o: unknown, fn: unknown) => fn),
    runWithRequestContext: vi.fn((_c: unknown, fn: () => unknown) => fn()),
    getRequestId: vi.fn(() => undefined),
    generateRequestId: vi.fn(() => 'test-request-id'),
    logger: stub,
  };
});

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@sentry/node', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    getCurrentScope: vi.fn(() => ({
      setUser: vi.fn(),
      setTag: vi.fn(),
      setTags: vi.fn(),
      setContext: vi.fn(),
      setExtra: vi.fn(),
      clear: vi.fn(),
    })),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (s: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

import { createCallerFactory, router } from '../../init';
import { apiKeyRouter } from '../../routers/core/api-key';
import { resolveApiKey } from '../../services/api-key-service';

// getHmacSecret is lazy — set the secret before the first resolve/generate call.
process.env.API_KEY_HMAC_SECRET = 'test-hmac-secret-at-least-32-chars-long';

const sessionCaller = createCallerFactory(router({ apiKey: apiKeyRouter }));

function makeSessionCaller() {
  return sessionCaller({
    headers: new Headers(),
    session: {
      session: {
        id: 'session-1',
        userId: CREATOR_ID,
        activeOrganizationId: ORG_ID,
        expiresAt: new Date('2099-01-01'),
        token: 'mock-token',
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
      },
      user: { id: CREATOR_ID, name: 'Creator', email: 'c@example.com', role: 'admin' },
    } as never,
    user: { id: CREATOR_ID, name: 'Creator', email: 'c@example.com', role: 'admin' } as never,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('grace-aware resolveByPrefix', () => {
  it('excludes revoked keys and admits superseded keys only within their grace window', async () => {
    await resolveApiKey('co_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefg');

    const whereArg = (
      mockPrisma.organizationApiKey.findMany.mock.calls[0]?.[0] as {
        where: Record<string, unknown>;
      }
    ).where;

    // Revocation exclusion must be preserved.
    expect(whereArg.revokedAt).toBeNull();
    // Grace-aware admission: the query must reference the supersession columns so
    // a superseded key resolves ONLY while graceExpiresAt is in the future.
    expect(JSON.stringify(whereArg)).toContain('graceExpiresAt');
    expect(JSON.stringify(whereArg)).toContain('supersededAt');
  });
});

describe('apiKey.rotate mutation', () => {
  it('issues a new key and supersedes the old one with a grace window', async () => {
    mockPrisma.organizationApiKey.findFirst.mockResolvedValueOnce({
      id: KEY_ID,
      organizationId: ORG_ID,
      name: 'Prod Key',
      scopes: ['contractor:read'],
      actingUserId: CREATOR_ID,
      expiresAt: null,
      revokedAt: null,
      supersededAt: null,
    });
    const caller = makeSessionCaller() as unknown as {
      apiKey: { rotate: (i: unknown) => Promise<{ plaintext: string }> };
    };

    const result = await caller.apiKey.rotate({ id: KEY_ID });
    expect(result.plaintext).toMatch(/^co_live_/);

    // A NEW key row was created and the OLD row superseded with a grace window.
    expect(mockPrisma.organizationApiKey.create).toHaveBeenCalled();
    const updateArg = mockPrisma.organizationApiKey.update.mock.calls.find(
      c => (c[0] as { where: { id: string } }).where.id === KEY_ID,
    )?.[0] as { data: Record<string, unknown> } | undefined;
    expect(updateArg?.data.supersededAt).toBeInstanceOf(Date);
    expect(updateArg?.data.graceExpiresAt).toBeInstanceOf(Date);
  });

  it('rejects rotating a revoked key', async () => {
    mockPrisma.organizationApiKey.findFirst.mockResolvedValueOnce({
      id: KEY_ID,
      organizationId: ORG_ID,
      revokedAt: new Date(),
      supersededAt: null,
    });
    const caller = makeSessionCaller() as unknown as {
      apiKey: { rotate: (i: unknown) => Promise<unknown> };
    };
    await expect(caller.apiKey.rotate({ id: KEY_ID })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects rotating an already-superseded key (single grace chain)', async () => {
    mockPrisma.organizationApiKey.findFirst.mockResolvedValueOnce({
      id: KEY_ID,
      organizationId: ORG_ID,
      revokedAt: null,
      supersededAt: new Date(),
    });
    const caller = makeSessionCaller() as unknown as {
      apiKey: { rotate: (i: unknown) => Promise<unknown> };
    };
    await expect(caller.apiKey.rotate({ id: KEY_ID })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});

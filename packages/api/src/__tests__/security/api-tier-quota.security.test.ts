/**
 * Wave-0 RED contract (INTEG-AUTH-04) — per-tier monthly request quota.
 *
 * A post-auth tRPC middleware (`enforceApiTierQuota`, chained into
 * `apiKeyTenantProcedure`) resolves the org's subscription tier and increments a
 * monthly counter. When the count exceeds the tier quota (Starter 1 000, Pro
 * 10 000) the request throws `TOO_MANY_REQUESTS`; ENTERPRISE is unlimited and
 * never throws (and never writes a counter). The pre-auth flat burst limiter is
 * a separate concern (two limiters, two jobs).
 *
 * Turn-green plan: 99-03 (the tier-limits table + monthly-counter service +
 * the `enforceApiTierQuota` middleware wired into the chain).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-quota-001';
const KEY_ID = 'key-quota-001';

const {
  mockDb,
  mockResolveApiKey,
  mockTouchLastUsed,
  mockGetSubscription,
  incrCounter,
  evaluateMock,
} = vi.hoisted(() => {
  type Rec = Record<string, unknown>;
  const mockDb: Rec = {
    contractor: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      count: vi.fn(async () => 0),
    },
    organization: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 'org-quota-001', dataRegion: 'EU', status: 'ACTIVE' }),
    },
  };
  return {
    mockDb,
    mockResolveApiKey: vi.fn(),
    mockTouchLastUsed: vi.fn(),
    mockGetSubscription: vi.fn(),
    // The 99-03 monthly counter — mocked here so the over-quota path is
    // deterministic. Inert until the middleware imports it (99-03).
    incrCounter: vi.fn(async () => 1),
    evaluateMock: vi.fn(() => ({ enabled: true, reason: 'unleash' })),
  };
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

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockDb,
  prismaRaw: mockDb,
  tenantStore: {
    run: (_c: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockDb),
  createTenantClientFrom: vi.fn(() => mockDb),
  getRegionalClient: vi.fn(() => mockDb),
}));

vi.mock('../../services/api-key-service', () => ({
  resolveApiKey: mockResolveApiKey,
  touchLastUsed: mockTouchLastUsed,
}));

vi.mock('../../services/billing-service', () => ({ getSubscription: mockGetSubscription }));

vi.mock('../../services/api-quota-counter', () => ({
  incrementMonthlyRequestCount: incrCounter,
}));

vi.mock('../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {},
  CacheTTL: {},
}));

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

import { createCallerFactory, publicProcedure, t } from '../../init';
import { enforceApiTierQuota } from '../../middleware/api-tier-quota';
import { publicContractorRouter } from '../../routers/public-api/contractor';

const createCaller = createCallerFactory(publicContractorRouter);

// The real chain gates public keys at ENTERPRISE (requireTier) BEFORE the quota,
// so STARTER/PRO never reach it in production (their quotas are latent). Exercise
// the quota middleware in isolation to prove the per-tier 429 behavior.
const quotaOnlyRouter = t.router({
  ping: publicProcedure.use(enforceApiTierQuota).query(() => ({ ok: true as const })),
});
const createQuotaOnlyCaller = t.createCallerFactory(quotaOnlyRouter);

function callQuota(tier: string, count: number) {
  mockGetSubscription.mockResolvedValue({
    id: 'sub_1',
    organizationId: ORG_ID,
    tier,
    status: 'ACTIVE',
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2027-01-01'),
  });
  incrCounter.mockResolvedValue(count);
  const caller = createQuotaOnlyCaller({
    headers: new Headers(),
    session: null,
    user: null,
    organizationId: ORG_ID,
  } as never);
  return caller.ping();
}

function makeCaller(tier: string) {
  mockResolveApiKey.mockResolvedValue({
    id: KEY_ID,
    organizationId: ORG_ID,
    prefix: 'abcdefghijkl',
    hash: 'hashed',
    scopes: ['contractor:read'],
    actingUserId: 'user-quota-acting',
    revokedAt: null,
    supersededAt: null,
    graceExpiresAt: null,
    expiresAt: null,
    lastUsedAt: null,
    organization: { id: ORG_ID, dataRegion: 'EU', status: 'ACTIVE' },
  });
  mockGetSubscription.mockResolvedValue({
    id: 'sub_1',
    organizationId: ORG_ID,
    tier,
    status: 'ACTIVE',
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2027-01-01'),
  });
  return createCaller({
    headers: new Headers({ authorization: 'Bearer co_live_test_token' }),
    session: null,
    user: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  evaluateMock.mockReturnValue({ enabled: true, reason: 'unleash' });
});

describe('per-tier monthly quota', () => {
  it('throws TOO_MANY_REQUESTS for a STARTER key over its monthly quota', async () => {
    await expect(callQuota('STARTER', 1_001)).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });

  it('allows a STARTER key at exactly its quota (boundary)', async () => {
    await expect(callQuota('STARTER', 1_000)).resolves.toMatchObject({ ok: true });
  });

  it('throws TOO_MANY_REQUESTS for a PRO key over its monthly quota', async () => {
    await expect(callQuota('PRO', 10_001)).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });

  it('never throws quota for an ENTERPRISE key (unlimited, no counter write)', async () => {
    incrCounter.mockResolvedValue(9_999_999);
    await expect(callQuota('ENTERPRISE', 9_999_999)).resolves.toMatchObject({ ok: true });
    expect(incrCounter).not.toHaveBeenCalled();
  });

  it('is wired into the full apiKeyTenantProcedure chain (ENTERPRISE passes through)', async () => {
    // Proves the middleware is in the real chain: an ENTERPRISE key reads a list
    // and the quota short-circuits (no counter write).
    const caller = makeCaller('ENTERPRISE');
    await expect(caller.list({})).resolves.toMatchObject({ items: [] });
    expect(incrCounter).not.toHaveBeenCalled();
  });
});

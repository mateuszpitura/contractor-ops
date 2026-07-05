/**
 * D-05 double-dark gate (INTEG-API-01) — per-org `module.public-api`.
 *
 * With `module.public-api` evaluated OFF for the caller's org, the entire public
 * surface must be invisible: a public READ throws NOT_FOUND (404 hides
 * existence). With the flag ON, the gate passes through. The write half is
 * proven once the write procedures exist (HOLD-until-98-09) — but because writes
 * are added under the SAME `apiKeyTenantProcedure` chain, they inherit this gate
 * by construction.
 *
 * Two layers of coverage:
 *   1. Unit — `assertPublicApiEnabled` throws NOT_FOUND off / passes on.
 *   2. Integration — the real `publicContractorRouter.list` (built on
 *      `apiKeyTenantProcedure`) 404s when the flag is off and passes when on,
 *      proving the gate is WIRED into the shared procedure.
 */

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-flag-001';
const KEY_ID = 'key-flag-001';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockDb, mockResolveApiKey, mockTouchLastUsed, mockGetSubscription, evaluateMock } =
  vi.hoisted(() => {
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
          .mockResolvedValue({ id: 'org-flag-001', dataRegion: 'EU', status: 'ACTIVE' }),
      },
    };
    return {
      mockDb,
      mockResolveApiKey: vi.fn(),
      mockTouchLastUsed: vi.fn(),
      mockGetSubscription: vi.fn(),
      evaluateMock: vi.fn(),
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
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockDb),
  createTenantClientFrom: vi.fn(() => mockDb),
  getRegionalClient: vi.fn(() => mockDb),
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

vi.mock('../../services/api-key-service', () => ({
  resolveApiKey: mockResolveApiKey,
  touchLastUsed: mockTouchLastUsed,
}));

vi.mock('../../services/billing-service', () => ({ getSubscription: mockGetSubscription }));

vi.mock('../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {},
  CacheTTL: {},
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { PUBLIC_API_DISABLED } from '../../errors';
import { createCallerFactory } from '../../init';
import { assertPublicApiEnabled } from '../../middleware/require-public-api-flag';
import { publicContractorRouter } from '../../routers/public-api/contractor';

const createCaller = createCallerFactory(publicContractorRouter);

function makeCaller(scopes = ['contractor:read']) {
  mockResolveApiKey.mockResolvedValue({
    id: KEY_ID,
    organizationId: ORG_ID,
    prefix: 'abcdefghijkl',
    hash: 'hashed',
    scopes,
    revokedAt: null,
    expiresAt: null,
    lastUsedAt: null,
    organization: { id: ORG_ID, dataRegion: 'EU', status: 'ACTIVE' },
  });
  mockGetSubscription.mockResolvedValue({
    id: 'sub_1',
    organizationId: ORG_ID,
    tier: 'ENTERPRISE',
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
});

describe('assertPublicApiEnabled unit', () => {
  it('throws NOT_FOUND when the flag is OFF (dark)', () => {
    evaluateMock.mockReturnValue({ enabled: false, reason: 'disabled' });
    let thrown: unknown;
    try {
      assertPublicApiEnabled(ORG_ID, 'EU');
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(TRPCError);
    expect((thrown as TRPCError).code).toBe('NOT_FOUND');
  });

  it('passes through when the flag is ON', () => {
    evaluateMock.mockReturnValue({ enabled: true, reason: 'unleash' });
    expect(() => assertPublicApiEnabled(ORG_ID, 'EU')).not.toThrow();
  });
});

describe('module.public-api dark gate wired into apiKeyTenantProcedure', () => {
  it('read (contractor.list) throws NOT_FOUND when the flag is OFF', async () => {
    evaluateMock.mockReturnValue({ enabled: false, reason: 'disabled' });
    const caller = makeCaller();
    await expect(caller.list({})).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('read (contractor.list) passes the gate when the flag is ON', async () => {
    evaluateMock.mockReturnValue({ enabled: true, reason: 'unleash' });
    const caller = makeCaller();
    await expect(caller.list({})).resolves.toMatchObject({ items: [] });
  });
});

// The write half inherits the SAME gate (apiKeyTenantProcedure). The write
// procedures land in 99-04; this asserts the double-dark write-404 — a write is
// invisible (NOT_FOUND) when the flag is off, ahead of any scope check.
// RED until 99-04 adds `contractor.create` / `contractor.update`.
describe('module.public-api dark gate — write half', () => {
  it('a write (contractor.create) throws NOT_FOUND (dark) when the flag is OFF', async () => {
    evaluateMock.mockReturnValue({ enabled: false, reason: 'disabled' });
    const caller = makeCaller(['contractor:create']) as unknown as {
      create: (i: unknown) => Promise<unknown>;
    };
    // Asserting the dark-gate message (not a bare NOT_FOUND) so a not-yet-built
    // procedure — which also 404s as "No procedure found" — stays RED.
    await expect(caller.create({})).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: PUBLIC_API_DISABLED,
    });
  });

  it('a write (contractor.update) throws NOT_FOUND (dark) when the flag is OFF', async () => {
    evaluateMock.mockReturnValue({ enabled: false, reason: 'disabled' });
    const caller = makeCaller(['contractor:update']) as unknown as {
      update: (i: unknown) => Promise<unknown>;
    };
    await expect(caller.update({})).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: PUBLIC_API_DISABLED,
    });
  });
});

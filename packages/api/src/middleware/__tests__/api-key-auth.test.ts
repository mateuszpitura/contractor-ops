import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveApiKey, mockTouchLastUsed, mockGetSubscription } = vi.hoisted(
  () => ({
    mockPrisma: {
      organization: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
      },
    },
    mockResolveApiKey: vi.fn(),
    mockTouchLastUsed: vi.fn(),
    mockGetSubscription: vi.fn(),
  }),
);

vi.mock('../../services/api-key-service', () => ({
  resolveApiKey: mockResolveApiKey,
  touchLastUsed: mockTouchLastUsed,
  appendApiKeyIpEvent: vi.fn(),
}));

// The chain carries the per-org `module.public-api` dark gate (default OFF); these
// tests assert auth + tier behavior, so evaluate the flag as ON to reach them.
vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: vi.fn(() => ({ enabled: true, reason: 'test' })),
}));

vi.mock('../../services/billing-service', () => ({
  getSubscription: mockGetSubscription,
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
  tenantStore: {
    run: (_ctx: { organizationId: string; region: string }, fn: () => unknown) => fn(),
    getStore: vi.fn(),
  },
  getRegionalClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn((client: unknown) => client),
}));

vi.mock('@contractor-ops/auth', () => ({
  auth: { api: {} },
}));

vi.mock('@sentry/node', () => {
  const mockSpan = {
    setStatus: vi.fn(),
    setAttribute: vi.fn(),
    end: vi.fn(),
  };
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
    setTags: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
  withBodyLogging: vi.fn((_o, fn) => fn),
  logIntegrationCall: vi.fn(),
  subscribeOpossumEvents: vi.fn(),
  runWithRequestContext: vi.fn((_c, fn) => fn()),
  getRequestId: vi.fn(() => undefined),
  getTraceparent: vi.fn(() => undefined),
  buildContextFromHeaders: vi.fn(() => ({})),
  getOutboundHeaders: vi.fn(() => ({})),
  generateRequestId: vi.fn(() => 'test-request-id'),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  LOG_BODY_INCLUDE_PREFIXES: [],
  PII_MASK_KEYWORDS: [],
  PII_MASK_PATHS: [],
  createLogger: vi.fn(() => ({
    info: vi.fn(),

    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn(), histogram: vi.fn() },
}));

import { t } from '../../init';
import { apiKeyTenantProcedure } from '../api-key-auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeKeyRecord(overrides?: Record<string, unknown>) {
  return {
    id: 'key-1',
    organizationId: 'org-api',
    prefix: 'abcdefghijkl',
    hash: 'hashed',
    scopes: ['contractor:read', 'invoice:read'],
    revokedAt: null,
    expiresAt: null,
    lastUsedAt: null,
    organization: { id: 'org-api', dataRegion: 'EU', status: 'ACTIVE' },
    ...overrides,
  };
}

function makeSub(tier: string, status = 'ACTIVE') {
  return {
    id: 'sub_1',
    organizationId: 'org-api',
    tier,
    status,
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_stripe_1',
    stripeSubscriptionItemId: 'si_1',
    seatCount: 1,
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2026-02-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('apiKeyTenantProcedure', () => {
  const router = t.router({
    secured: apiKeyTenantProcedure.query(({ ctx }) => ({
      authMode: (ctx as Record<string, unknown>).authMode,
      apiKeyId: (ctx as Record<string, unknown>).apiKeyId,
      apiKeyScopes: (ctx as Record<string, unknown>).apiKeyScopes,
    })),
  });
  const createCaller = t.createCallerFactory(router);

  beforeEach(() => {
    mockResolveApiKey.mockReset();
    mockTouchLastUsed.mockReset();
    mockGetSubscription.mockReset();
  });

  it('authenticates with a valid API key and enriches context', async () => {
    const keyRecord = makeKeyRecord();
    mockResolveApiKey.mockResolvedValue(keyRecord);
    mockGetSubscription.mockResolvedValue(makeSub('ENTERPRISE'));

    const caller = createCaller({
      headers: new Headers({ authorization: 'Bearer co_live_abc123' }),
      session: null,
      user: null,
    });

    const result = await caller.secured();
    expect(result.authMode).toBe('apiKey');
    expect(result.apiKeyId).toBe('key-1');
    expect(result.apiKeyScopes).toEqual(['contractor:read', 'invoice:read']);
  });

  it('calls touchLastUsed fire-and-forget on valid key', async () => {
    mockResolveApiKey.mockResolvedValue(makeKeyRecord());
    mockGetSubscription.mockResolvedValue(makeSub('ENTERPRISE'));

    const caller = createCaller({
      headers: new Headers({ authorization: 'Bearer co_live_abc123' }),
      session: null,
      user: null,
    });

    await caller.secured();
    expect(mockTouchLastUsed).toHaveBeenCalledWith('key-1', 'EU');
  });

  it('throws UNAUTHORIZED when Authorization header is missing', async () => {
    const caller = createCaller({
      headers: new Headers(),
      session: null,
      user: null,
    });

    await expect(caller.secured()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(mockResolveApiKey).not.toHaveBeenCalled();
  });

  it('throws UNAUTHORIZED when key has wrong prefix (not co_live_)', async () => {
    const caller = createCaller({
      headers: new Headers({ authorization: 'Bearer sk_test_abc123' }),
      session: null,
      user: null,
    });

    await expect(caller.secured()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(mockResolveApiKey).not.toHaveBeenCalled();
  });

  it('throws UNAUTHORIZED when resolveApiKey returns null (invalid key)', async () => {
    mockResolveApiKey.mockResolvedValue(null);

    const caller = createCaller({
      headers: new Headers({ authorization: 'Bearer co_live_invalid' }),
      session: null,
      user: null,
    });

    await expect(caller.secured()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(mockTouchLastUsed).not.toHaveBeenCalled();
  });

  it('throws FORBIDDEN when subscription tier is below ENTERPRISE', async () => {
    mockResolveApiKey.mockResolvedValue(makeKeyRecord());
    mockGetSubscription.mockResolvedValue(makeSub('PRO'));

    const caller = createCaller({
      headers: new Headers({ authorization: 'Bearer co_live_abc123' }),
      session: null,
      user: null,
    });

    await expect(caller.secured()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

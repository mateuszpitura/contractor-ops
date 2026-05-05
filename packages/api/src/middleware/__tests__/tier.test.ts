import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockGetSubscription } = vi.hoisted(() => {
  const mockPrisma = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
  };
  return { mockPrisma, mockGetSubscription: vi.fn() };
});

vi.mock('../../services/billing-service.js', () => ({
  getSubscription: mockGetSubscription,
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = {
    setStatus: vi.fn(),
    setAttribute: vi.fn(),
    end: vi.fn(),
  };
  return {
    getCurrentScope: vi.fn(() => ({ setUser: vi.fn(), setTag: vi.fn(), setTags: vi.fn(), setContext: vi.fn(), setExtra: vi.fn(), clear: vi.fn() })),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
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
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
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

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T,>(c: T) => c,
  withRlsReads: <T,>(c: T) => c,
  prisma: mockPrisma,
  tenantStore: {
    run: (_ctx: { organizationId: string; region: string }, fn: () => unknown) => fn(),
    getStore: vi.fn(),
  },
  getRegionalClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn((client: unknown) => client),
}));

// P2-C/F-DB-03 — getOrgMeta uses services/cache.ts which speaks to Upstash
// Redis. minimalServerEnv sets placeholder Upstash URL/token so the real
// client tries an HTTP call and hangs the test. Bypass cache → fn() to keep
// tests fast and deterministic.
vi.mock('../../services/cache.js', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {},
  CacheTTL: {},
}));

import { t } from '../../init.js';
import { tenantProcedure } from '../tenant.js';
import { enterpriseProcedure, proProcedure, requireTier } from '../tier.js';

function authedWithOrg() {
  const userId = 'user_tier';
  const session = {
    session: {
      id: 'sess-tier',
      userId,
      activeOrganizationId: 'org_tier',
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: userId,
      name: 'Test',
      email: 't@example.com',
      emailVerified: true,
      image: null,
      banned: false,
      banReason: null,
      banExpires: null,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  return {
    headers: new Headers(),
    session: session as never,
    user: session.user as never,
  };
}

function makeSub(tier: string, status: string = 'ACTIVE') {
  return {
    id: 'sub_1',
    organizationId: 'org_tier',
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

describe('requireTier', () => {
  const router = t.router({
    proGated: tenantProcedure.use(requireTier('PRO')).query(() => 'pro-ok'),
    enterpriseGated: tenantProcedure.use(requireTier('ENTERPRISE')).query(() => 'enterprise-ok'),
    starterGated: tenantProcedure.use(requireTier('STARTER')).query(() => 'starter-ok'),
  });
  const createCaller = t.createCallerFactory(router);

  beforeEach(() => {
    mockGetSubscription.mockReset();
  });

  it('passes when org has PRO subscription and PRO is required', async () => {
    mockGetSubscription.mockResolvedValue(makeSub('PRO'));
    await expect(createCaller(authedWithOrg()).proGated()).resolves.toBe('pro-ok');
    expect(mockGetSubscription).toHaveBeenCalledWith('org_tier');
  });

  it('passes when org has ENTERPRISE subscription and PRO is required (higher tier)', async () => {
    mockGetSubscription.mockResolvedValue(makeSub('ENTERPRISE'));
    await expect(createCaller(authedWithOrg()).proGated()).resolves.toBe('pro-ok');
  });

  it('throws FORBIDDEN when org has STARTER subscription and PRO is required', async () => {
    mockGetSubscription.mockResolvedValue(makeSub('STARTER'));
    try {
      await createCaller(authedWithOrg()).proGated();
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('FORBIDDEN');
      const parsed = JSON.parse((e as TRPCError).message);
      expect(parsed).toEqual({
        type: 'TIER_REQUIRED',
        requiredTier: 'PRO',
        currentTier: 'STARTER',
      });
    }
  });

  it('throws FORBIDDEN when org has PRO subscription and ENTERPRISE is required', async () => {
    mockGetSubscription.mockResolvedValue(makeSub('PRO'));
    try {
      await createCaller(authedWithOrg()).enterpriseGated();
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('FORBIDDEN');
      const parsed = JSON.parse((e as TRPCError).message);
      expect(parsed).toEqual({
        type: 'TIER_REQUIRED',
        requiredTier: 'ENTERPRISE',
        currentTier: 'PRO',
      });
    }
  });

  it('throws FORBIDDEN when org has no subscription (null)', async () => {
    mockGetSubscription.mockResolvedValue(null);
    try {
      await createCaller(authedWithOrg()).proGated();
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('FORBIDDEN');
      const parsed = JSON.parse((e as TRPCError).message);
      expect(parsed).toEqual({
        type: 'TIER_REQUIRED',
        requiredTier: 'PRO',
        currentTier: null,
      });
    }
  });

  it('throws FORBIDDEN when subscription status is CANCELLED', async () => {
    mockGetSubscription.mockResolvedValue(makeSub('PRO', 'CANCELLED'));
    try {
      await createCaller(authedWithOrg()).proGated();
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('FORBIDDEN');
      const parsed = JSON.parse((e as TRPCError).message);
      expect(parsed).toEqual({
        type: 'TIER_REQUIRED',
        requiredTier: 'PRO',
        currentTier: null,
      });
    }
  });

  it('passes for TRIALING subscription when STARTER tier is required', async () => {
    mockGetSubscription.mockResolvedValue(makeSub('STARTER', 'TRIALING'));
    await expect(createCaller(authedWithOrg()).starterGated()).resolves.toBe('starter-ok');
  });
});

describe('proProcedure and enterpriseProcedure', () => {
  const router = t.router({
    proPing: proProcedure.query(() => 'pro-ping'),
    enterprisePing: enterpriseProcedure.query(() => 'enterprise-ping'),
  });
  const createCaller = t.createCallerFactory(router);

  beforeEach(() => {
    mockGetSubscription.mockReset();
  });

  it('proProcedure and enterpriseProcedure are exported and chain correctly from tenantProcedure', async () => {
    mockGetSubscription.mockResolvedValue(makeSub('ENTERPRISE'));
    await expect(createCaller(authedWithOrg()).proPing()).resolves.toBe('pro-ping');
    await expect(createCaller(authedWithOrg()).enterprisePing()).resolves.toBe('enterprise-ping');
  });
});

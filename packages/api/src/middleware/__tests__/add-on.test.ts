// Phase 82 · Plan 01 · FOUND7-01 (SC#1) — Wave 0 RED scaffold.
//
// Encodes the requireAddOn entitlement-middleware contract that Plan 82-04
// implements. RED is the expected Wave 0 state: `../add-on` does not exist
// yet, so vitest collects this file and the cases fail at import resolution.
// Do NOT implement requireAddOn here.
//
// Contract (locked by 82-CONTEXT D-01/D-02/D-11 + 82-PATTERNS):
//   - ADD_ON_KEYS = ['workforce','us-cross-border'] as const (lowercase wire keys).
//   - requireAddOn(addOn) reads the same Redis-cached getSubscription(orgId) as
//     requireTier (addOns rides along on the cached Subscription, no 2nd query).
//   - Deny → TRPCError FORBIDDEN, message = JSON.stringify(
//       { type:'ADD_ON_REQUIRED', requiredAddOn:addOn, currentAddOns: sub.addOns ?? [] }).
//   - workforceProcedure / usCrossBorderProcedure compose
//       tenantProcedure → requireTier('STARTER') → requireAddOn(addOn)
//     (D-11: STARTER floor = "any active subscription"; chain order asserted).

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

vi.mock('../../services/billing-service', () => ({
  getSubscription: mockGetSubscription,
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
    setTags: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() })),
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
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn(), histogram: vi.fn() },
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

vi.mock('../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {},
  CacheTTL: {},
}));

import { t } from '../../init';
// RED (Wave 0): `../add-on` is implemented in Plan 82-04. Importing it now is the
// failing edge — the contract below is what 82-04 must satisfy.
import { ADD_ON_KEYS, requireAddOn, usCrossBorderProcedure, workforceProcedure } from '../add-on';
import { tenantProcedure } from '../tenant';

function authedWithOrg() {
  const userId = 'user_addon';
  const session = {
    session: {
      id: 'sess-addon',
      userId,
      activeOrganizationId: 'org_addon',
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

function makeSub(addOns: string[], tier = 'STARTER', status = 'ACTIVE') {
  return {
    id: 'sub_1',
    organizationId: 'org_addon',
    tier,
    status,
    addOns,
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

describe('ADD_ON_KEYS', () => {
  it('is the locked lowercase wire-key tuple (D-01)', () => {
    expect(ADD_ON_KEYS).toEqual(['workforce', 'us-cross-border']);
  });
});

describe('requireAddOn — deny path (SC#1)', () => {
  const router = t.router({
    workforceGated: tenantProcedure.use(requireAddOn('workforce')).query(() => 'wf-ok'),
  });
  const createCaller = t.createCallerFactory(router);

  beforeEach(() => {
    mockGetSubscription.mockReset();
  });

  it('throws FORBIDDEN with ADD_ON_REQUIRED JSON when addOns lacks the add-on', async () => {
    mockGetSubscription.mockResolvedValue(makeSub([]));
    try {
      await createCaller(authedWithOrg()).workforceGated();
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('FORBIDDEN');
      const parsed = JSON.parse((e as TRPCError).message);
      expect(parsed).toEqual({
        type: 'ADD_ON_REQUIRED',
        requiredAddOn: 'workforce',
        currentAddOns: [],
      });
    }
    expect(mockGetSubscription).toHaveBeenCalledWith('org_addon');
  });
});

describe('requireAddOn — allow path (SC#1)', () => {
  const router = t.router({
    workforceGated: tenantProcedure.use(requireAddOn('workforce')).query(() => 'wf-ok'),
  });
  const createCaller = t.createCallerFactory(router);

  beforeEach(() => {
    mockGetSubscription.mockReset();
  });

  it('passes through (next called) when addOns includes the add-on', async () => {
    mockGetSubscription.mockResolvedValue(makeSub(['workforce']));
    await expect(createCaller(authedWithOrg()).workforceGated()).resolves.toBe('wf-ok');
  });
});

describe('convenience procedures compose requireTier(STARTER) BEFORE requireAddOn (D-11 chain order)', () => {
  const router = t.router({
    workforcePing: workforceProcedure.query(() => 'wf-ping'),
    usCrossBorderPing: usCrossBorderProcedure.query(() => 'us-ping'),
  });
  const createCaller = t.createCallerFactory(router);

  beforeEach(() => {
    mockGetSubscription.mockReset();
  });

  it('passes when org has an active (STARTER) subscription AND the add-on', async () => {
    mockGetSubscription.mockResolvedValue(makeSub(['workforce', 'us-cross-border']));
    await expect(createCaller(authedWithOrg()).workforcePing()).resolves.toBe('wf-ping');
    await expect(createCaller(authedWithOrg()).usCrossBorderPing()).resolves.toBe('us-ping');
  });

  it('fails the requireTier(STARTER) gate FIRST when there is no active subscription (chain order)', async () => {
    // No subscription → the STARTER floor (requireTier) must reject with
    // TIER_REQUIRED before requireAddOn is reached. This pins the chain order.
    mockGetSubscription.mockResolvedValue(null);
    try {
      await createCaller(authedWithOrg()).workforcePing();
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('FORBIDDEN');
      const parsed = JSON.parse((e as TRPCError).message);
      expect(parsed.type).toBe('TIER_REQUIRED');
    }
  });

  it('reaches requireAddOn (ADD_ON_REQUIRED) when subscription is active but the add-on is absent', async () => {
    mockGetSubscription.mockResolvedValue(makeSub([]));
    try {
      await createCaller(authedWithOrg()).workforcePing();
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('FORBIDDEN');
      const parsed = JSON.parse((e as TRPCError).message);
      expect(parsed.type).toBe('ADD_ON_REQUIRED');
      expect(parsed.requiredAddOn).toBe('workforce');
    }
  });
});

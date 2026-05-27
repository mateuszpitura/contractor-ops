import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSubscription = vi.fn();
const mockGetCreditBalance = vi.fn();

const { prismaMock, mockContractorCount } = vi.hoisted(() => {
  const mockContractorCount = vi.fn();
  const prismaMock = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    contractor: { count: (...args: unknown[]) => mockContractorCount(...args) },
    subscription: { findUnique: vi.fn() },
  };
  return { prismaMock, mockContractorCount };
});

vi.mock('../../services/billing-service', () => ({
  getSubscription: (...args: unknown[]) => mockGetSubscription(...args),
  createCheckoutSession: vi.fn(),
  createTopUpCheckoutSession: vi.fn(),
  getProrationPreview: vi.fn(),
  createPortalSession: vi.fn(),
  ensureStripeCustomer: vi.fn(),
  updateSubscriptionSeatCount: vi.fn(),
}));

vi.mock('../../services/credit-service', () => ({
  getCreditBalance: (...args: unknown[]) => mockGetCreditBalance(...args),
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: prismaMock,
  tenantStore: {
    run: (_ctx: { organizationId: string }, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => prismaMock),
  createTenantClientFrom: vi.fn(() => prismaMock),
  getRegionalClient: vi.fn(() => prismaMock),
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
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
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
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), distribution: vi.fn(), histogram: vi.fn() },
}));

import { t } from '../../init';
import { billingRouter } from '../finance/billing';

function authedWithOrg() {
  const userId = 'user_billing';
  const session = {
    session: {
      id: 'sess-billing',
      userId,
      activeOrganizationId: 'org_billing',
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

function makeSub(tier: string) {
  return {
    id: 'sub_1',
    organizationId: 'org_billing',
    tier,
    status: 'ACTIVE',
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_stripe_1',
    stripeSubscriptionItemId: 'si_1',
    seatCount: 5,
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2026-02-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const createCaller = t.createCallerFactory(t.router({ billing: billingRouter }));

describe('getUsageDashboard', () => {
  beforeEach(() => {
    mockGetSubscription.mockReset();
    mockGetCreditBalance.mockReset();
    mockContractorCount.mockReset();
  });

  it('returns subscription data, credit balance, active contractor count, included seats, and planConfig', async () => {
    const sub = makeSub('PRO');
    mockGetSubscription.mockResolvedValue(sub);
    mockGetCreditBalance.mockResolvedValue({
      balance: 80,
      allowance: 100,
      used: 20,
      tier: 'PRO',
    });
    mockContractorCount.mockResolvedValue(12);

    const result = await createCaller(authedWithOrg()).billing.getUsageDashboard();

    expect(result.subscription).toEqual(sub);
    expect(result.credits).toEqual({
      balance: 80,
      allowance: 100,
      used: 20,
      tier: 'PRO',
    });
    expect(result.activeContractors).toBe(12);
    expect(result.includedSeats).toBe(Math.floor(29_900 / 1_500)); // 19
    expect(result.planConfig).toBeDefined();
    expect(result.planConfig.tiers).toHaveLength(3);
  });

  it('returns null subscription and zero credits when no subscription exists', async () => {
    mockGetSubscription.mockResolvedValue(null);
    mockGetCreditBalance.mockResolvedValue({
      balance: 0,
      allowance: 0,
      used: 0,
      tier: null,
    });
    mockContractorCount.mockResolvedValue(0);

    const result = await createCaller(authedWithOrg()).billing.getUsageDashboard();

    expect(result.subscription).toBeNull();
    expect(result.credits.balance).toBe(0);
    expect(result.includedSeats).toBe(0);
  });

  it('calculates includedSeats as floor(basePriceMinor / seatPriceMinor) for PRO tier', async () => {
    mockGetSubscription.mockResolvedValue(makeSub('PRO'));
    mockGetCreditBalance.mockResolvedValue({
      balance: 100,
      allowance: 100,
      used: 0,
      tier: 'PRO',
    });
    mockContractorCount.mockResolvedValue(5);

    const result = await createCaller(authedWithOrg()).billing.getUsageDashboard();

    // PRO: floor(29900 / 1500) = floor(19.933) = 19
    expect(result.includedSeats).toBe(19);
  });

  it('activeContractors reflects actual count from DB', async () => {
    mockGetSubscription.mockResolvedValue(makeSub('STARTER'));
    mockGetCreditBalance.mockResolvedValue({
      balance: 15,
      allowance: 20,
      used: 5,
      tier: 'STARTER',
    });
    mockContractorCount.mockResolvedValue(42);

    const result = await createCaller(authedWithOrg()).billing.getUsageDashboard();

    expect(result.activeContractors).toBe(42);
    expect(mockContractorCount).toHaveBeenCalledWith({
      where: { organizationId: 'org_billing', status: 'ACTIVE' },
    });
  });

  it('planConfig matches PLAN_CONFIG structure with tiers array', async () => {
    mockGetSubscription.mockResolvedValue(makeSub('ENTERPRISE'));
    mockGetCreditBalance.mockResolvedValue({
      balance: 500,
      allowance: 500,
      used: 0,
      tier: 'ENTERPRISE',
    });
    mockContractorCount.mockResolvedValue(3);

    const result = await createCaller(authedWithOrg()).billing.getUsageDashboard();

    expect(result.planConfig.tiers).toHaveLength(3);
    expect(result.planConfig.tiers.map((t: { id: string }) => t.id)).toEqual([
      'STARTER',
      'PRO',
      'ENTERPRISE',
    ]);
    expect(result.planConfig.trialDays).toBe(14);
    expect(result.planConfig.currency).toBe('PLN');
  });
});

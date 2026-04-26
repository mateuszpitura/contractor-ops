/**
 * Billing router unit tests.
 *
 * Strategy:
 *  - Mock `@contractor-ops/db` with a vi.hoisted mockPrisma.
 *  - Mock `@contractor-ops/auth`, billing-service, credit-service, logger, Sentry.
 *  - Create a tRPC caller via `createCallerFactory` + `makeCaller`.
 *  - Each test verifies delegation params, guard logic, and data flow.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';
const STRIPE_CUSTOMER_ID = 'cus_test123';
const STRIPE_SUB_ID = 'sub_test123';
const STRIPE_ITEM_ID = 'si_test123';
const PRICE_ID = 'price_starter_monthly';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(async () => ({
        dataRegion: 'EU',
        billingEmail: 'billing@test.com',
        name: 'Test Org',
      })),
    },
    contractor: {
      count: vi.fn(async () => 5),
    },
    member: {
      findFirst: vi.fn(async () => ({ role: 'admin' })),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma };
});

// ---------------------------------------------------------------------------
// Mock billing service functions (hoisted)
// ---------------------------------------------------------------------------

const {
  mockGetSubscription,
  mockCreateCheckoutSession,
  mockCreatePortalSession,
  mockGetProrationPreview,
  mockEnsureStripeCustomer,
  mockCreateTopUpCheckoutSession,
  mockUpdateSubscriptionSeatCount,
} = vi.hoisted(() => ({
  mockGetSubscription: vi.fn(async () => null),
  mockCreateCheckoutSession: vi.fn(async () => ({ url: 'https://checkout.stripe.com/session' })),
  mockCreatePortalSession: vi.fn(async () => ({ url: 'https://billing.stripe.com/portal' })),
  mockGetProrationPreview: vi.fn(async () => ({
    immediateTotal: 5000,
    proratedCredits: 2000,
    newPriceAmount: 29900,
  })),
  mockEnsureStripeCustomer: vi.fn(async () => STRIPE_CUSTOMER_ID),
  mockCreateTopUpCheckoutSession: vi.fn(async () => ({ url: 'https://checkout.stripe.com/topup' })),
  mockUpdateSubscriptionSeatCount: vi.fn(async () => undefined),
}));

// ---------------------------------------------------------------------------
// Mock modules
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue({ success: true }),
    },
  },
  authApi: {
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

vi.mock('../../services/billing-service.js', () => ({
  getSubscription: mockGetSubscription,
  createCheckoutSession: mockCreateCheckoutSession,
  createPortalSession: mockCreatePortalSession,
  getProrationPreview: mockGetProrationPreview,
  ensureStripeCustomer: mockEnsureStripeCustomer,
  createTopUpCheckoutSession: mockCreateTopUpCheckoutSession,
  updateSubscriptionSeatCount: mockUpdateSubscriptionSeatCount,
}));

vi.mock('../../services/credit-service.js', () => ({
  getCreditBalance: vi.fn(async () => ({ credits: 42 })),
}));

vi.mock('../../services/billing-constants.js', () => ({
  TIER_CREDIT_ALLOWANCE: { STARTER: 20, PRO: 100, ENTERPRISE: 500 },
  TRIAL_CREDIT_ALLOWANCE: 5,
  KNOWN_SUBSCRIPTION_PRICE_IDS: new Set([
    'price_starter_monthly',
    'price_pro_monthly',
    'price_enterprise_monthly',
  ]),
  KNOWN_TOPUP_PRICE_IDS: new Set(['price_topup_10', 'price_topup_50']),
}));

vi.mock('../../services/r2.js', () => ({
  createPresignedUploadUrl: vi.fn(async () => ({
    url: 'https://r2.example.com/upload',
    key: 'mock-key',
  })),
  createPresignedDownloadUrl: vi.fn(async () => 'https://r2.example.com/download'),
  generateStorageKey: vi.fn(() => 'mock-storage-key'),
  headObject: vi.fn(async () => ({ ContentLength: 1024 })),
  deleteObject: vi.fn(async () => undefined),
}));

vi.mock('../../services/cache.js', () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {
    orgSettings: (orgId: string) => `org-settings:${orgId}`,
    orgSettingsJson: (orgId: string, key: string) => `org-settings-json:${orgId}:${key}`,
    orgBranding: (orgId: string) => `org-branding:${orgId}`,
    settingsPrefix: (orgId: string) => `org-settings:${orgId}`,
    approvalChains: (orgId: string) => `approval-chains:${orgId}`,
  },
  CacheTTL: { ORG_SETTINGS: 300, ORG_SETTINGS_JSON: 300, ORG_BRANDING: 300, APPROVAL_CHAINS: 300 },
}));

vi.mock('../../services/notification-service.js', () => ({
  dispatch: vi.fn(async () => undefined),
  getOrCreatePreferences: vi.fn(async () => ({})),
}));

vi.mock('../../services/invoice-matching.js', () => ({
  computeDuplicateCheckHash: vi.fn(() => 'hash'),
  runAutoMatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/bank-account-crypto.js', () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('../../services/sanitize.js', () => ({
  sanitizeStrings: vi.fn(<T>(v: T) => v),
}));

vi.mock('../../services/approval-engine.js', () => ({
  routeToChain: vi.fn(async () => null),
  createApprovalFlow: vi.fn(async () => ({})),
  advanceFlow: vi.fn(async () => undefined),
  computeSlaStatus: vi.fn(() => 'ON_TIME'),
}));

vi.mock('../../services/calendar-event-service.js', () => ({
  deleteCalendarEvent: vi.fn(async () => undefined),
}));

vi.mock('../../services/calendar-deadline-sync.js', () => ({
  syncPaymentDueDeadline: vi.fn(async () => undefined),
  syncApprovalSlaDeadline: vi.fn(async () => undefined),
}));

vi.mock('../../services/report-export.js', () => ({
  generateAuditCsv: vi.fn(async () => ({ base64: 'bW9jaw==', filename: 'audit.csv' })),
}));

vi.mock('../../services/portal-change-request.js', () => ({
  approveChangeRequest: vi.fn(async () => undefined),
  rejectChangeRequest: vi.fn(async () => undefined),
}));

vi.mock('../../services/mime-validator.js', () => ({
  isAllowedMimeType: vi.fn(() => true),
  validateMimeType: vi.fn(async () => ({ valid: true })),
}));

vi.mock('../../services/virus-scanner.js', () => ({
  isClamAvailable: vi.fn(async () => false),
  scanBuffer: vi.fn(async () => ({ clean: true })),
}));

vi.mock('../../services/stripe-client.js', () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    invoices: { retrieveUpcoming: vi.fn() },
  },
}));

vi.mock('../../services/ocr-extraction.js', () => ({
  extractInvoiceData: vi.fn(async () => ({})),
}));

vi.mock('../../services/billing-webhook.js', () => ({
  handleStripeWebhook: vi.fn(async () => undefined),
}));

vi.mock('../../services/payment-export.js', () => ({
  generateCsv: vi.fn(async () => Buffer.from('csv-data')),
  generateElixir: vi.fn(() => Buffer.from('elixir-data')),
  generateSepaXml: vi.fn(() => Buffer.from('sepa-data')),
  resolveTransferTitle: vi.fn(() => 'FV/2025/001'),
}));

vi.mock('../../services/bank-statement.js', () => ({
  parseBankStatement: vi.fn(() => []),
  matchStatementToRun: vi.fn(() => []),
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { auth } from '@contractor-ops/auth';
import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(appRouter);

function makeCaller(userId: string, orgId: string) {
  const session = {
    session: {
      id: `session-${userId}`,
      userId,
      activeOrganizationId: orgId,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: userId,
      name: 'Test User',
      email: `${userId}@example.com`,
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
  return createCaller({
    headers: new Headers(),
    session: session as never,
    user: session.user as never,
  });
}

const caller = makeCaller(USER_ID, ORG_ID);

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.hasPermission).mockResolvedValue({ success: true } as never);
});

// ===========================================================================
// Tests
// ===========================================================================

describe('billing.getSubscription', () => {
  it('delegates to billing-service getSubscription with organizationId', async () => {
    const mockSub = {
      id: 'sub-1',
      stripeCustomerId: STRIPE_CUSTOMER_ID,
      stripeSubscriptionId: STRIPE_SUB_ID,
      status: 'ACTIVE',
      tier: 'STARTER',
    };
    mockGetSubscription.mockResolvedValueOnce(mockSub as unknown);

    const result = await caller.billing.getSubscription();

    expect(mockGetSubscription).toHaveBeenCalledWith(ORG_ID);
    expect(result).toEqual(mockSub);
  });
});

describe('billing.createCheckoutSession', () => {
  it('rejects unknown price IDs before calling Stripe', async () => {
    await expect(caller.billing.createCheckoutSession({ priceId: 'price_fake' })).rejects.toThrow(
      'Invalid subscription price ID',
    );

    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });

  it('passes contractor count as seat quantity (minimum 1)', async () => {
    mockGetSubscription.mockResolvedValueOnce(null); // no existing sub -> isNewOrg
    mockPrisma.contractor.count.mockResolvedValueOnce(12);

    await caller.billing.createCheckoutSession({ priceId: PRICE_ID });

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        priceId: PRICE_ID,
        stripeCustomerId: STRIPE_CUSTOMER_ID,
        isNewOrg: true,
        quantity: 12,
      }),
    );
  });

  it('uses billing email from org or generates fallback', async () => {
    mockPrisma.organization.findUnique
      .mockResolvedValueOnce({ dataRegion: 'EU' })
      .mockResolvedValueOnce({
        billingEmail: null,
        name: 'No Email Org',
      });
    mockGetSubscription.mockResolvedValueOnce(null);
    mockPrisma.contractor.count.mockResolvedValueOnce(0);

    await caller.billing.createCheckoutSession({ priceId: PRICE_ID });

    expect(mockEnsureStripeCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        email: `billing@${ORG_ID}.local`,
        name: 'No Email Org',
      }),
    );
  });

  it('sets isNewOrg to false when existing subscription exists', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      id: 'sub-existing',
      stripeCustomerId: STRIPE_CUSTOMER_ID,
    } as unknown);
    mockPrisma.contractor.count.mockResolvedValueOnce(3);

    await caller.billing.createCheckoutSession({ priceId: PRICE_ID });

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        isNewOrg: false,
      }),
    );
  });
});

describe('billing.createPortalSession', () => {
  it('throws NOT_FOUND when no subscription exists', async () => {
    mockGetSubscription.mockResolvedValueOnce(null);

    await expect(caller.billing.createPortalSession()).rejects.toThrow(
      'No active subscription found',
    );

    expect(mockCreatePortalSession).not.toHaveBeenCalled();
  });

  it('passes stripeCustomerId and return URL to billing-service', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      stripeCustomerId: STRIPE_CUSTOMER_ID,
      stripeSubscriptionId: STRIPE_SUB_ID,
    } as unknown);

    await caller.billing.createPortalSession();

    expect(mockCreatePortalSession).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeCustomerId: STRIPE_CUSTOMER_ID,
        returnUrl: expect.stringContaining('/settings?tab=billing'),
      }),
    );
  });
});

describe('billing.getProrationPreview', () => {
  it('throws NOT_FOUND when no subscription exists', async () => {
    mockGetSubscription.mockResolvedValueOnce(null);

    await expect(caller.billing.getProrationPreview({ newPriceId: PRICE_ID })).rejects.toThrow(
      'No active subscription found',
    );
  });

  it('throws PRECONDITION_FAILED when subscription has no item ID', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      stripeCustomerId: STRIPE_CUSTOMER_ID,
      stripeSubscriptionId: STRIPE_SUB_ID,
      stripeSubscriptionItemId: null,
    } as unknown);

    await expect(caller.billing.getProrationPreview({ newPriceId: PRICE_ID })).rejects.toThrow(
      'Subscription item ID not available',
    );
  });

  it('delegates all Stripe IDs to billing-service getProrationPreview', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      stripeCustomerId: STRIPE_CUSTOMER_ID,
      stripeSubscriptionId: STRIPE_SUB_ID,
      stripeSubscriptionItemId: STRIPE_ITEM_ID,
    } as unknown);

    await caller.billing.getProrationPreview({ newPriceId: PRICE_ID });

    expect(mockGetProrationPreview).toHaveBeenCalledWith({
      stripeCustomerId: STRIPE_CUSTOMER_ID,
      stripeSubscriptionId: STRIPE_SUB_ID,
      stripeSubscriptionItemId: STRIPE_ITEM_ID,
      newPriceId: PRICE_ID,
    });
  });

  it('rejects unknown price IDs', async () => {
    await expect(
      caller.billing.getProrationPreview({ newPriceId: 'price_unknown' }),
    ).rejects.toThrow('Invalid subscription price ID');

    expect(mockGetProrationPreview).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// billing.createTopUpCheckout
// ===========================================================================

describe('billing.createTopUpCheckout', () => {
  it('rejects unknown top-up price IDs', async () => {
    await expect(
      caller.billing.createTopUpCheckout({ priceId: 'price_fake_topup' }),
    ).rejects.toThrow('Invalid top-up price ID');

    expect(mockCreateTopUpCheckoutSession).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when no subscription exists', async () => {
    mockGetSubscription.mockResolvedValueOnce(null);

    await expect(caller.billing.createTopUpCheckout({ priceId: 'price_topup_10' })).rejects.toThrow(
      'No active subscription found',
    );

    expect(mockCreateTopUpCheckoutSession).not.toHaveBeenCalled();
  });

  it('delegates to createTopUpCheckoutSession with correct params', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      stripeCustomerId: STRIPE_CUSTOMER_ID,
      stripeSubscriptionId: STRIPE_SUB_ID,
    } as unknown);

    await caller.billing.createTopUpCheckout({ priceId: 'price_topup_10' });

    expect(mockCreateTopUpCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        priceId: 'price_topup_10',
        stripeCustomerId: STRIPE_CUSTOMER_ID,
        successUrl: expect.stringContaining('/settings?tab=billing&topup=success'),
        cancelUrl: expect.stringContaining('/settings?tab=billing'),
      }),
    );
  });
});

// ===========================================================================
// billing.syncSeatCount
// ===========================================================================

describe('billing.syncSeatCount', () => {
  it('throws NOT_FOUND when no subscription with item ID exists', async () => {
    mockGetSubscription.mockResolvedValueOnce(null);

    await expect(caller.billing.syncSeatCount()).rejects.toThrow(
      'No active subscription with a subscription item found',
    );
  });

  it('throws PRECONDITION_FAILED when subscription is not active or trialing', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      stripeCustomerId: STRIPE_CUSTOMER_ID,
      stripeSubscriptionId: STRIPE_SUB_ID,
      stripeSubscriptionItemId: STRIPE_ITEM_ID,
      status: 'CANCELED',
      seatCount: 5,
    } as unknown);

    await expect(caller.billing.syncSeatCount()).rejects.toThrow('Subscription is not active');
  });

  it('returns updated:false when seat count matches', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      stripeCustomerId: STRIPE_CUSTOMER_ID,
      stripeSubscriptionId: STRIPE_SUB_ID,
      stripeSubscriptionItemId: STRIPE_ITEM_ID,
      status: 'ACTIVE',
      seatCount: 5,
    } as unknown);
    mockPrisma.contractor.count.mockResolvedValueOnce(5);

    const result = await caller.billing.syncSeatCount();

    expect(result).toEqual({ updated: false, seatCount: 5 });
    expect(mockUpdateSubscriptionSeatCount).not.toHaveBeenCalled();
  });

  it('updates seat count when contractor count differs', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      stripeCustomerId: STRIPE_CUSTOMER_ID,
      stripeSubscriptionId: STRIPE_SUB_ID,
      stripeSubscriptionItemId: STRIPE_ITEM_ID,
      status: 'ACTIVE',
      seatCount: 5,
    } as unknown);
    mockPrisma.contractor.count.mockResolvedValueOnce(8);

    const result = await caller.billing.syncSeatCount();

    expect(result).toEqual({ updated: true, seatCount: 8 });
    expect(mockUpdateSubscriptionSeatCount).toHaveBeenCalledWith({
      stripeSubscriptionId: STRIPE_SUB_ID,
      stripeSubscriptionItemId: STRIPE_ITEM_ID,
      newQuantity: 8,
    });
  });

  it('ensures minimum seat count of 1 even with zero contractors', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      stripeCustomerId: STRIPE_CUSTOMER_ID,
      stripeSubscriptionId: STRIPE_SUB_ID,
      stripeSubscriptionItemId: STRIPE_ITEM_ID,
      status: 'TRIALING',
      seatCount: 5,
    } as unknown);
    mockPrisma.contractor.count.mockResolvedValueOnce(0);

    const result = await caller.billing.syncSeatCount();

    expect(result).toEqual({ updated: true, seatCount: 1 });
    expect(mockUpdateSubscriptionSeatCount).toHaveBeenCalledWith(
      expect.objectContaining({ newQuantity: 1 }),
    );
  });
});

// ===========================================================================
// billing.getCreditBalance
// ===========================================================================

describe('billing.getCreditBalance', () => {
  it('returns credit balance for the organization', async () => {
    const result = await caller.billing.getCreditBalance();

    expect(result).toEqual({ credits: 42 });
  });
});

// ===========================================================================
// billing.getPlanConfig
// ===========================================================================

describe('billing.getPlanConfig', () => {
  it('returns static plan configuration', async () => {
    const result = await caller.billing.getPlanConfig();

    expect(result).toHaveProperty('tiers');
    expect(result.tiers).toHaveLength(3);
    expect(result.tiers[0]).toHaveProperty('id', 'STARTER');
    expect(result.tiers[1]).toHaveProperty('id', 'PRO');
    expect(result.tiers[2]).toHaveProperty('id', 'ENTERPRISE');
    expect(result).toHaveProperty('trialDays', 14);
    expect(result).toHaveProperty('currency', 'PLN');
  });
});

// ===========================================================================
// billing.getUsageDashboard
// ===========================================================================

describe('billing.getUsageDashboard', () => {
  it('aggregates subscription, credits, and contractor data', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      id: 'sub-1',
      tier: 'STARTER',
      stripeCustomerId: STRIPE_CUSTOMER_ID,
      status: 'ACTIVE',
    } as unknown);
    mockPrisma.contractor.count.mockResolvedValueOnce(10);

    const result = await caller.billing.getUsageDashboard();

    expect(result).toHaveProperty('subscription');
    expect(result).toHaveProperty('credits');
    expect(result).toHaveProperty('activeContractors', 10);
    expect(result).toHaveProperty('includedSeats');
    expect(result).toHaveProperty('planConfig');
    expect(result.planConfig.tiers).toHaveLength(3);
  });

  it('returns zero included seats when no subscription exists', async () => {
    mockGetSubscription.mockResolvedValueOnce(null);
    mockPrisma.contractor.count.mockResolvedValueOnce(0);

    const result = await caller.billing.getUsageDashboard();

    expect(result.subscription).toBeNull();
    expect(result.includedSeats).toBe(0);
  });
});

// ===========================================================================
// billing.createCheckoutSession — org not found
// ===========================================================================

describe('billing.createCheckoutSession — org not found', () => {
  it('throws NOT_FOUND when organization does not exist', async () => {
    // First findUnique returns region, second returns null for the org lookup
    mockPrisma.organization.findUnique
      .mockResolvedValueOnce({ dataRegion: 'EU' })
      .mockResolvedValueOnce(null);

    await expect(caller.billing.createCheckoutSession({ priceId: PRICE_ID })).rejects.toThrow(
      'Organization not found',
    );
  });
});

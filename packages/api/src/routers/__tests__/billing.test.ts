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
    auditLog: {
      create: vi.fn(async () => ({ id: 'audit-mock' })),
      createMany: vi.fn(async () => ({ count: 1 })),
    },
    organization: {
      findUnique: vi.fn(async () => ({
        dataRegion: 'EU',
        status: 'ACTIVE',
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
    subscription: {
      findUnique: vi.fn(async () => ({
        id: 'sub-1',
        organizationId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx',
        tier: 'STARTER',
        status: 'ACTIVE',
        addOns: [],
      })),
      update: vi.fn(async () => ({ id: 'sub-1' })),
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
  mockInvalidate,
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
  mockInvalidate: vi.fn(async () => undefined),
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
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  // compliance-reminder-scan.ts captures `prismaRaw` into a module-level
  // __deps const at import time (reached transitively via appRouter), so the
  // mock must export it or collection fails before any test runs.
  prismaRaw: mockPrisma,
  SUPPORTED_REGIONS: ['EU', 'ME', 'US'],
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

vi.mock('../../services/billing-service', () => ({
  getSubscription: mockGetSubscription,
  createCheckoutSession: mockCreateCheckoutSession,
  createPortalSession: mockCreatePortalSession,
  getProrationPreview: mockGetProrationPreview,
  ensureStripeCustomer: mockEnsureStripeCustomer,
  createTopUpCheckoutSession: mockCreateTopUpCheckoutSession,
  updateSubscriptionSeatCount: mockUpdateSubscriptionSeatCount,
}));

vi.mock('../../services/credit-service', () => ({
  getCreditBalance: vi.fn(async () => ({ credits: 42 })),
}));

vi.mock('../../services/billing-constants', () => ({
  TIER_CREDIT_ALLOWANCE: { STARTER: 20, PRO: 100, ENTERPRISE: 500 },
  TRIAL_CREDIT_ALLOWANCE: 5,
  KNOWN_SUBSCRIPTION_PRICE_IDS: new Set([
    'price_starter_monthly',
    'price_pro_monthly',
    'price_enterprise_monthly',
  ]),
  KNOWN_TOPUP_PRICE_IDS: new Set(['price_topup_10', 'price_topup_50']),
}));

vi.mock('../../services/r2', () => ({
  maxBytesForMime: vi.fn(() => 10485760),
  MAX_BYTES_BY_MIME: { 'application/pdf': 52428800 },
  createPresignedUploadUrl: vi.fn(async () => ({
    url: 'https://r2.example.com/upload',
    key: 'mock-key',
  })),
  createPresignedDownloadUrl: vi.fn(async () => 'https://r2.example.com/download'),
  generateStorageKey: vi.fn(() => 'mock-storage-key'),
  headObject: vi.fn(async () => ({ ContentLength: 1024 })),
  deleteObject: vi.fn(async () => undefined),
}));

vi.mock('../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: mockInvalidate,
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {
    orgSettings: (orgId: string) => `org-settings:${orgId}`,
    orgSettingsJson: (orgId: string, key: string) => `org-settings-json:${orgId}:${key}`,
    orgBranding: (orgId: string) => `org-branding:${orgId}`,
    settingsPrefix: (orgId: string) => `org-settings:${orgId}`,
    approvalChains: (orgId: string) => `approval-chains:${orgId}`,
    subscription: (orgId: string) => `${orgId}:billing:sub`,
  },
  CacheTTL: { ORG_SETTINGS: 300, ORG_SETTINGS_JSON: 300, ORG_BRANDING: 300, APPROVAL_CHAINS: 300 },
}));

vi.mock('../../services/notification-service', () => ({
  dispatch: vi.fn(async () => undefined),
  getOrCreatePreferences: vi.fn(async () => ({})),
}));

vi.mock('../../services/invoice-matching', () => ({
  computeDuplicateCheckHash: vi.fn(() => 'hash'),
  runAutoMatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/bank-account-crypto', () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('../../services/sanitize', () => ({
  sanitizeStrings: vi.fn(<T>(v: T) => v),
}));

vi.mock('../../services/approval-engine', () => ({
  routeToChain: vi.fn(async () => null),
  createApprovalFlow: vi.fn(async () => ({})),
  advanceFlow: vi.fn(async () => undefined),
  computeSlaStatus: vi.fn(() => 'ON_TIME'),
}));

vi.mock('../../services/calendar-event-service', () => ({
  deleteCalendarEvent: vi.fn(async () => undefined),
}));

vi.mock('../../services/calendar-deadline-sync', () => ({
  syncPaymentDueDeadline: vi.fn(async () => undefined),
  syncApprovalSlaDeadline: vi.fn(async () => undefined),
}));

vi.mock('../../services/report-export', () => ({
  generateAuditCsv: vi.fn(async () => ({ base64: 'bW9jaw==', filename: 'audit.csv' })),
}));

vi.mock('../../services/portal-change-request', () => ({
  approveChangeRequest: vi.fn(async () => undefined),
  rejectChangeRequest: vi.fn(async () => undefined),
}));

vi.mock('../../services/mime-validator', () => ({
  isAllowedMimeType: vi.fn(() => true),
  validateMimeType: vi.fn(async () => ({ valid: true })),
}));

vi.mock('../../services/virus-scanner', () => ({
  isClamAvailable: vi.fn(async () => false),
  scanBuffer: vi.fn(async () => ({ clean: true })),
}));

vi.mock('../../services/stripe-client', () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    invoices: { retrieveUpcoming: vi.fn() },
  },
}));

vi.mock('../../services/ocr-extraction', () => ({
  extractInvoiceData: vi.fn(async () => ({})),
}));

vi.mock('../../services/billing-webhook', () => ({
  handleStripeWebhook: vi.fn(async () => undefined),
}));

vi.mock('../../services/payment-export', () => ({
  generateCsv: vi.fn(async () => Buffer.from('csv-data')),
  generateElixir: vi.fn(() => Buffer.from('elixir-data')),
  generateSepaXml: vi.fn(() => Buffer.from('sepa-data')),
  resolveTransferTitle: vi.fn(() => 'FV/2025/001'),
}));

vi.mock('../../services/bank-statement', () => ({
  parseBankStatement: vi.fn(() => []),
  matchStatementToRun: vi.fn(() => []),
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
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { auth, authApi } from '@contractor-ops/auth';
import { createCallerFactory, router } from '../../init';
import { billingRouter } from '../finance/billing';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

// Mount billingRouter on a minimal standalone router instead of importing the
// full appRouter. The appRouter import chain pulls unrelated routers
// (integrations/deprovisioning → getIdpAuditLogger at module load) whose
// module-level side-effects this test's mocks do not satisfy, causing a
// collection failure that has nothing to do with billing. Isolating to
// billingRouter keeps these tests focused and runnable.
const testRouter = router({ billing: billingRouter });
const createCaller = createCallerFactory(testRouter);

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
  // adminProcedure resolves via authApi.hasPermission; clearAllMocks wiped the
  // definition-time default, so restore "permitted" before each test.
  vi.mocked(authApi.hasPermission).mockResolvedValue({ success: true } as never);
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
      'billingInvalidSubscriptionPriceId',
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
      .mockResolvedValueOnce({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' })
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
      'billingNoActiveSubscription',
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
      'billingNoActiveSubscription',
    );
  });

  it('throws PRECONDITION_FAILED when subscription has no item ID', async () => {
    mockGetSubscription.mockResolvedValueOnce({
      stripeCustomerId: STRIPE_CUSTOMER_ID,
      stripeSubscriptionId: STRIPE_SUB_ID,
      stripeSubscriptionItemId: null,
    } as unknown);

    await expect(caller.billing.getProrationPreview({ newPriceId: PRICE_ID })).rejects.toThrow(
      'billingSubscriptionItemUnavailable',
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
    ).rejects.toThrow('billingInvalidSubscriptionPriceId');

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
    ).rejects.toThrow('billingInvalidTopupPriceId');

    expect(mockCreateTopUpCheckoutSession).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when no subscription exists', async () => {
    mockGetSubscription.mockResolvedValueOnce(null);

    await expect(caller.billing.createTopUpCheckout({ priceId: 'price_topup_10' })).rejects.toThrow(
      'billingNoSubscriptionSubscribeFirst',
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
      .mockResolvedValueOnce({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' })
      .mockResolvedValueOnce(null);

    await expect(caller.billing.createCheckoutSession({ priceId: PRICE_ID })).rejects.toThrow(
      'billingOrganizationNotFound',
    );
  });
});

// ===========================================================================
// billing.grantAddOn — FOUND7-01 (SC#1) owner-gated audit-logged cache-invalidating grant
// ===========================================================================

describe('billing.grantAddOn', () => {
  it('is owner-gated: rejects when the actor lacks organization:update', async () => {
    // adminProcedure delegates to authApi.hasPermission (Better Auth session path).
    vi.mocked(authApi.hasPermission).mockResolvedValueOnce({ success: false } as never);

    await expect(caller.billing.grantAddOn({ addOn: 'workforce' })).rejects.toThrow();

    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('validates addOn against ADD_ON_KEYS (rejects unknown add-on)', async () => {
    await expect(
      // @ts-expect-error — exercising the z.enum boundary with an invalid value
      caller.billing.grantAddOn({ addOn: 'not-a-real-add-on' }),
    ).rejects.toThrow();

    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('writes the deduped addOns array to the Subscription', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      organizationId: ORG_ID,
      tier: 'STARTER',
      status: 'ACTIVE',
      addOns: ['workforce'],
    } as unknown);

    const result = await caller.billing.grantAddOn({ addOn: 'us-cross-border' });

    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID },
        data: { addOns: ['workforce', 'us-cross-border'] },
      }),
    );
    expect(result).toEqual({ addOns: ['workforce', 'us-cross-border'] });
  });

  it('does not duplicate an already-granted add-on', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      organizationId: ORG_ID,
      tier: 'STARTER',
      status: 'ACTIVE',
      addOns: ['workforce'],
    } as unknown);

    const result = await caller.billing.grantAddOn({ addOn: 'workforce' });

    expect(result).toEqual({ addOns: ['workforce'] });
  });

  it('audit-logs the grant with resourceType ORGANIZATION and action subscription.addon.granted', async () => {
    await caller.billing.grantAddOn({ addOn: 'workforce' });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'subscription.addon.granted',
          resourceType: 'ORGANIZATION',
          resourceId: ORG_ID,
          organizationId: ORG_ID,
        }),
      }),
    );
  });

  it('invalidates the subscription cache after the write so requireAddOn sees the grant immediately (no stale deny)', async () => {
    await caller.billing.grantAddOn({ addOn: 'workforce' });

    // requireAddOn reads the 15-min-cached getSubscription; the grant MUST
    // invalidate CacheKeys.subscription(orgId) or the just-granted add-on is
    // denied for up to the cache TTL (Pitfall 3).
    expect(mockInvalidate).toHaveBeenCalledWith(`${ORG_ID}:billing:sub`);
  });

  it('throws NOT_FOUND when the org has no subscription', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);

    await expect(caller.billing.grantAddOn({ addOn: 'workforce' })).rejects.toThrow(
      'billingNoActiveSubscription',
    );

    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });
});

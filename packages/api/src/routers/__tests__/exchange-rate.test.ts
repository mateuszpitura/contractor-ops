/**
 * Exchange Rate router unit tests.
 *
 * Strategy:
 *  - Mock `@contractor-ops/db` with a vi.hoisted mockPrisma.
 *  - Mock `@contractor-ops/auth`, exchange-rate service, logger, Sentry.
 *  - Create a tRPC caller via `createCallerFactory` + `makeCaller`.
 *  - Each test verifies delegation params, guard logic, and data flow.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';
const CRON_SECRET = 'test-cron-secret';

// ---------------------------------------------------------------------------
// Mock Prisma + services (hoisted)
// ---------------------------------------------------------------------------

const { mockPrisma, mockGetRate, mockConvertAmount, mockFetchAndStoreRates } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(async () => ({
        dataRegion: 'EU',
        status: 'ACTIVE',
        billingEmail: 'billing@test.com',
        name: 'Test Org',
      })),
    },
    exchangeRate: {
      findMany: vi.fn(),
    },
    contractor: { count: vi.fn(async () => 0) },
    member: { findFirst: vi.fn(async () => ({ role: 'admin' })) },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return {
    mockPrisma,
    mockGetRate: vi.fn(),
    mockConvertAmount: vi.fn(),
    mockFetchAndStoreRates: vi.fn(),
  };
});

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
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
  SUPPORTED_REGIONS: ['EU', 'US'],
}));

vi.mock('../../services/exchange-rate', () => ({
  getRate: mockGetRate,
  convertAmount: mockConvertAmount,
  fetchAndStoreRates: mockFetchAndStoreRates,
}));

vi.mock('@contractor-ops/validators', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getServerEnv: vi.fn(() => ({
      CRON_SECRET,
      NEXT_PUBLIC_APP_URL: 'https://app.test.com',
      DATABASE_URL: 'postgresql://test',
    })),
  };
});

vi.mock('../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
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

vi.mock('../../services/billing-service', () => ({
  getSubscription: vi.fn(async () => null),
  createCheckoutSession: vi.fn(async () => ({ url: 'https://checkout.stripe.com/session' })),
  createPortalSession: vi.fn(async () => ({ url: 'https://billing.stripe.com/portal' })),
  getProrationPreview: vi.fn(async () => ({
    immediateTotal: 0,
    proratedCredits: 0,
    newPriceAmount: 0,
  })),
  ensureStripeCustomer: vi.fn(async () => 'cus_test'),
  createTopUpCheckoutSession: vi.fn(async () => ({ url: 'https://checkout.stripe.com/topup' })),
  updateSubscriptionSeatCount: vi.fn(async () => undefined),
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

vi.mock('@sentry/nextjs', () => {
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

import { auth } from '@contractor-ops/auth';
import { createCallerFactory } from '../../init';
import { appRouter } from '../../root';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(appRouter);

function makeCaller(userId = USER_ID, orgId = ORG_ID) {
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

function makeCronCaller() {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${CRON_SECRET}`);
  return createCaller({
    headers,
    session: null as never,
    user: null as never,
  });
}

const _caller = makeCaller();

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

describe('exchangeRate.fetchDaily', () => {
  it('fetches and stores rates for all supported regions', async () => {
    mockFetchAndStoreRates.mockResolvedValue({ stored: 10, errors: [] });
    const cronCaller = makeCronCaller();

    const result = await cronCaller.exchangeRate.fetchDaily();

    expect(mockFetchAndStoreRates).toHaveBeenCalledTimes(2); // EU + US
    expect(result.stored).toBe(20);
    expect(result.errors).toEqual([]);
  });

  it('collects errors from failing regions', async () => {
    mockFetchAndStoreRates
      .mockResolvedValueOnce({ stored: 10, errors: [] })
      .mockRejectedValueOnce(new Error('DB connection failed'));
    const cronCaller = makeCronCaller();

    const result = await cronCaller.exchangeRate.fetchDaily();

    expect(result.stored).toBe(10);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('DB connection failed');
  });

  it('rejects unauthenticated cron requests', async () => {
    const badCaller = createCaller({
      headers: new Headers(),
      session: null as never,
      user: null as never,
    });

    await expect(badCaller.exchangeRate.fetchDaily()).rejects.toThrow();
  });

  it('collects per-region errors from fetchAndStoreRates result', async () => {
    mockFetchAndStoreRates
      .mockResolvedValueOnce({ stored: 5, errors: ['EUR/GBP stale'] })
      .mockResolvedValueOnce({ stored: 3, errors: ['EUR/JPY stale'] });
    const cronCaller = makeCronCaller();

    const result = await cronCaller.exchangeRate.fetchDaily();

    expect(result.stored).toBe(8);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('[EU]');
    expect(result.errors[1]).toContain('[US]');
  });

  it('handles all regions failing gracefully', async () => {
    mockFetchAndStoreRates
      .mockRejectedValueOnce(new Error('EU down'))
      .mockRejectedValueOnce(new Error('US down'));
    const cronCaller = makeCronCaller();

    const result = await cronCaller.exchangeRate.fetchDaily();

    expect(result.stored).toBe(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('EU down');
    expect(result.errors[1]).toContain('US down');
  });

  it('handles non-Error thrown values', async () => {
    mockFetchAndStoreRates
      .mockRejectedValueOnce('string error')
      .mockResolvedValueOnce({ stored: 5, errors: [] });
    const cronCaller = makeCronCaller();

    const result = await cronCaller.exchangeRate.fetchDaily();

    expect(result.stored).toBe(5);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('string error');
  });
});

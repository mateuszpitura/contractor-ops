/**
 * Tax router unit tests.
 *
 * Strategy:
 *  - Mock `@contractor-ops/db` with a vi.hoisted mockPrisma.
 *  - Mock `@contractor-ops/auth`, tax-rate.service, wht-certificate.service, logger, Sentry.
 *  - Create a tRPC caller via `createCallerFactory` + `makeCaller`.
 *  - Each test verifies delegation params, guard logic, and data flow.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';

// ---------------------------------------------------------------------------
// Mock Prisma + services (hoisted)
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockGetTaxRatesForCountry,
  mockValidateVatRateCode,
  mockCalculateWht,
  mockCreateWhtCertificate,
  mockListWhtCertificates,
} = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn(async () => ({
        dataRegion: 'EU', status: 'ACTIVE',
        billingEmail: 'billing@test.com',
        name: 'Test Org',
      })),
      findUniqueOrThrow: vi.fn(async () => ({ countryCode: 'PL' })),
    },
    invoice: {
      aggregate: vi.fn(async () => ({ _sum: { vatAmountMinor: 0 } })),
    },
    whtCertificate: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(),
    },
    paymentRunItem: {
      aggregate: vi.fn(async () => ({ _sum: { whtAmountMinor: 0 }, _count: 0 })),
    },
    contractor: { count: vi.fn(async () => 0) },
    member: { findFirst: vi.fn(async () => ({ role: 'admin' })) },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return {
    mockPrisma,
    mockGetTaxRatesForCountry: vi.fn(),
    mockValidateVatRateCode: vi.fn(),
    mockCalculateWht: vi.fn(),
    mockCreateWhtCertificate: vi.fn(),
    mockListWhtCertificates: vi.fn(),
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
  withRlsTransactions: <T,>(c: T) => c,
  withRlsReads: <T,>(c: T) => c,
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

vi.mock('../../services/tax-rate.service.js', () => ({
  getTaxRatesForCountry: mockGetTaxRatesForCountry,
  validateVatRateCode: mockValidateVatRateCode,
  calculateWht: mockCalculateWht,
}));

vi.mock('../../services/wht-certificate.service.js', () => ({
  createWhtCertificate: mockCreateWhtCertificate,
  listWhtCertificates: mockListWhtCertificates,
}));

vi.mock('../../services/cache.js', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  CacheKeys: {},
  CacheTTL: {},
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

vi.mock('../../services/r2.js', () => ({
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

vi.mock('../../services/billing-service.js', () => ({
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
import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';

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

const caller = makeCaller();

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.api.hasPermission).mockResolvedValue({ success: true } as never);
  // Reset default org lookup
  mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({ countryCode: 'PL' });
});

// ===========================================================================
// Tests
// ===========================================================================

describe('tax.getRates', () => {
  it('returns tax rates for the org country', async () => {
    const rates = [{ code: 'STD', rate: 23, label: 'Standard' }];
    mockGetTaxRatesForCountry.mockReturnValueOnce(rates);

    const result = await caller.tax.getRates();

    expect(mockPrisma.organization.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ORG_ID } }),
    );
    expect(mockGetTaxRatesForCountry).toHaveBeenCalledWith('PL');
    expect(result).toEqual(rates);
  });

  it('returns empty array when org has no countryCode', async () => {
    mockPrisma.organization.findUniqueOrThrow.mockResolvedValueOnce({ countryCode: null });

    const result = await caller.tax.getRates();

    expect(result).toEqual([]);
    expect(mockGetTaxRatesForCountry).not.toHaveBeenCalled();
  });
});

describe('tax.getRatesByCountry', () => {
  it('returns tax rates for the specified country', async () => {
    const rates = [{ code: 'STD', rate: 19, label: 'Standard' }];
    mockGetTaxRatesForCountry.mockReturnValueOnce(rates);

    const result = await caller.tax.getRatesByCountry({ countryCode: 'DE' });

    expect(mockGetTaxRatesForCountry).toHaveBeenCalledWith('DE');
    expect(result).toEqual(rates);
  });
});

describe('tax.validateRate', () => {
  it('returns valid true for a known rate code', async () => {
    mockValidateVatRateCode.mockResolvedValueOnce(true);

    const result = await caller.tax.validateRate({ code: 'STD' });

    expect(result).toEqual({ valid: true });
    expect(mockValidateVatRateCode).toHaveBeenCalledWith('PL', 'STD');
  });

  it('returns valid false when org has no countryCode', async () => {
    mockPrisma.organization.findUniqueOrThrow.mockResolvedValueOnce({ countryCode: null });

    const result = await caller.tax.validateRate({ code: 'STD' });

    expect(result).toEqual({ valid: false });
    expect(mockValidateVatRateCode).not.toHaveBeenCalled();
  });
});

describe('tax.calculateWht', () => {
  it('delegates to calculateWht service', async () => {
    const whtResult = { rate: 0.2, whtAmountMinor: 2000, netAmountMinor: 8000 };
    mockCalculateWht.mockReturnValueOnce(whtResult);

    const result = await caller.tax.calculateWht({
      contractorResidency: 'DE',
      serviceType: 'technical_services',
      grossAmountMinor: 10000,
    });

    expect(mockCalculateWht).toHaveBeenCalledWith('PL', 'DE', 'technical_services', 10000);
    expect(result).toEqual(whtResult);
  });

  it('returns null when org has no countryCode', async () => {
    mockPrisma.organization.findUniqueOrThrow.mockResolvedValueOnce({ countryCode: null });

    const result = await caller.tax.calculateWht({
      contractorResidency: 'DE',
      serviceType: 'technical_services',
      grossAmountMinor: 10000,
    });

    expect(result).toBeNull();
  });
});

describe('tax.generateWhtCertificate', () => {
  it('delegates to createWhtCertificate service', async () => {
    const cert = { id: 'cert-1', organizationId: ORG_ID };
    mockCreateWhtCertificate.mockResolvedValueOnce(cert);

    const result = await caller.tax.generateWhtCertificate({ paymentRunItemId: 'pri-1' });

    expect(mockCreateWhtCertificate).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      paymentRunItemId: 'pri-1',
      generatedByUserId: USER_ID,
    });
    expect(result).toEqual(cert);
  });
});

describe('tax.listWhtCertificates', () => {
  it('delegates to listWhtCertificates service', async () => {
    const certs = [{ id: 'cert-1' }, { id: 'cert-2' }];
    mockListWhtCertificates.mockResolvedValueOnce(certs);

    const result = await caller.tax.listWhtCertificates();

    expect(mockListWhtCertificates).toHaveBeenCalledWith(ORG_ID);
    expect(result).toEqual(certs);
  });
});

describe('tax.getWhtCertificate', () => {
  it('returns certificate by ID', async () => {
    const cert = { id: 'cert-1', organizationId: ORG_ID, whtAmountMinor: 2000 };
    mockPrisma.whtCertificate.findUnique.mockResolvedValueOnce(cert);

    const result = await caller.tax.getWhtCertificate({ certificateId: 'cert-1' });

    expect(result).toEqual(cert);
  });

  it('throws NOT_FOUND when certificate does not exist', async () => {
    mockPrisma.whtCertificate.findUnique.mockResolvedValueOnce(null);

    await expect(caller.tax.getWhtCertificate({ certificateId: 'nonexistent' })).rejects.toThrow();
  });

  it('throws NOT_FOUND when certificate belongs to another org', async () => {
    mockPrisma.whtCertificate.findUnique.mockResolvedValueOnce({
      id: 'cert-1',
      organizationId: 'other-org',
    });

    await expect(caller.tax.getWhtCertificate({ certificateId: 'cert-1' })).rejects.toThrow();
  });
});

describe('tax.taxSummary', () => {
  it('returns aggregated tax summary for the current period', async () => {
    mockPrisma.invoice.aggregate
      .mockResolvedValueOnce({ _sum: { vatAmountMinor: 5000 } })
      .mockResolvedValueOnce({ _sum: { vatAmountMinor: 2000 } });
    mockPrisma.whtCertificate.findMany.mockResolvedValueOnce([
      { whtAmountMinor: 1000 },
      { whtAmountMinor: 500 },
    ]);
    mockPrisma.paymentRunItem.aggregate.mockResolvedValueOnce({
      _sum: { whtAmountMinor: 3000 },
      _count: 5,
    });

    const result = await caller.tax.taxSummary();

    expect(result.vatCollectedMinor).toBe(5000);
    expect(result.vatOwedMinor).toBe(2000);
    expect(result.vatNetMinor).toBe(3000);
    expect(result.whtWithheldMinor).toBe(1500);
    expect(result.whtCertCount).toBe(2);
    expect(result.whtPendingMinor).toBe(1500); // 3000 - 1500
    expect(result.whtPendingCount).toBe(3); // max(0, 5 - 2)
    expect(result.periodStart).toBeDefined();
    expect(result.periodEnd).toBeDefined();
  });

  it('handles zero values gracefully', async () => {
    mockPrisma.invoice.aggregate
      .mockResolvedValueOnce({ _sum: { vatAmountMinor: null } })
      .mockResolvedValueOnce({ _sum: { vatAmountMinor: null } });
    mockPrisma.whtCertificate.findMany.mockResolvedValueOnce([]);
    mockPrisma.paymentRunItem.aggregate.mockResolvedValueOnce({
      _sum: { whtAmountMinor: null },
      _count: 0,
    });

    const result = await caller.tax.taxSummary();

    expect(result.vatCollectedMinor).toBe(0);
    expect(result.vatOwedMinor).toBe(0);
    expect(result.vatNetMinor).toBe(0);
    expect(result.whtWithheldMinor).toBe(0);
    expect(result.whtCertCount).toBe(0);
    expect(result.whtPendingMinor).toBe(0);
    expect(result.whtPendingCount).toBe(0);
  });
});

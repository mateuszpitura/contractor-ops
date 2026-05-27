/**
 * Skonto router unit tests.
 *
 * Tests upsertForInvoice, deleteForInvoice, upsertForBillingProfile,
 * deleteForBillingProfile, and evaluateForInvoice.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-skonto-001';
const USER_ID = 'user-skonto-001';
const INVOICE_ID = 'inv-skonto-001';
const BILLING_PROFILE_ID = 'bp-skonto-001';
const SKONTO_TERM_ID = 'term-skonto-001';

// ---------------------------------------------------------------------------
// Mock services via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockEvaluateSkontoEligibility, mockResolveSkontoTerm } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    invoice: {
      findFirst: vi.fn(),
    },
    skontoTerm: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    contractorBillingProfile: {
      findFirst: vi.fn(),
    },
    member: {
      findFirst: vi.fn().mockResolvedValue({ role: 'admin' }),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  return {
    mockPrisma,
    mockEvaluateSkontoEligibility: vi.fn(),
    mockResolveSkontoTerm: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/feature-flags', () => ({
  FLAG_KEYS: ['payments.skonto-enabled'],
  FLAGS: {
    'payments.skonto-enabled': {
      key: 'payments.skonto-enabled',
      description: 'Skonto early payment discount',
      default: false,
      category: 'payments',
      jurisdiction: 'EU',
      owner: 'payments',
    },
  },
  lazyFlagBag: vi.fn(() => ({
    values: { 'payments.skonto-enabled': true },
    isEnabled: (_key: string) => true,
  })),
}));

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
}));

vi.mock('../../services/skonto', () => ({
  evaluateSkontoEligibility: mockEvaluateSkontoEligibility,
  resolveSkontoTerm: mockResolveSkontoTerm,
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

// Stripe-client (and the billing-service that consumes it) is pulled in
// transitively through tier.ts → billing-service.ts when the router is
// registered via tenantFlaggedProcedure. Stripe-client imports getServerEnv
// from @contractor-ops/validators, which currently re-exports through a
// subpath that the api-package vitest alias cannot resolve. Stub it here so
// the test loader never walks into the broken subpath.
vi.mock('../../services/stripe-client', () => ({
  stripe: {},
  getStripeWebhookSecret: vi.fn(() => 'whsec_test'),
}));
vi.mock('../../services/billing-service', () => ({
  getSubscription: vi.fn(async () => ({ tier: 'enterprise' as const })),
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

vi.mock('@contractor-ops/logger', () => {
  const stub = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  };
  const loggerStub = { ...stub, child: vi.fn(() => ({ ...stub, child: vi.fn(() => stub) })) };
  return {
    runWithRequestContext: vi.fn((_c, fn) => fn()),
    getRequestId: vi.fn(() => undefined),
    getTraceparent: vi.fn(() => undefined),
    buildContextFromHeaders: vi.fn(() => ({})),
    getOutboundHeaders: vi.fn(() => ({})),
    generateRequestId: vi.fn(() => 'test-request-id'),
    withBodyLogging: vi.fn((_o, fn) => fn),
    logIntegrationCall: vi.fn(),
    subscribeOpossumEvents: vi.fn(),
    LOG_BODY_INCLUDE_PREFIXES: [],
    PII_MASK_KEYWORDS: [],
    PII_MASK_PATHS: [],

    logger: loggerStub,
    createTrpcLogger: vi.fn(() => stub),
    createLogger: vi.fn(() => stub),
    createCronLogger: vi.fn(() => stub),
    createWebhookLogger: vi.fn(() => stub),
    createIntegrationLogger: vi.fn(() => stub),
  };
});

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init';
import { skontoRouter } from '../finance/skonto';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(skontoRouter);

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
      name: 'Skonto User',
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
// Shared fixtures
// ---------------------------------------------------------------------------

const validTermInput = {
  percent: 2,
  discountDays: 10,
  netDays: 30,
};

const mockTerm = {
  id: SKONTO_TERM_ID,
  organizationId: ORG_ID,
  invoiceId: INVOICE_ID,
  billingProfileId: null,
  discountPercent: 2,
  discountPeriodDays: 10,
  netPeriodDays: 30,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// Tests
// ===========================================================================

describe('skontoRouter', () => {
  // =========================================================================
  // upsertForInvoice
  // =========================================================================

  describe('upsertForInvoice', () => {
    const input = { invoiceId: INVOICE_ID, ...validTermInput };

    it('upserts skonto term when invoice belongs to tenant', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce({
        id: INVOICE_ID,
        organizationId: ORG_ID,
      });
      mockPrisma.skontoTerm.upsert.mockResolvedValueOnce(mockTerm);

      const result = await caller.upsertForInvoice(input);

      expect(result).toMatchObject({ id: SKONTO_TERM_ID, discountPercent: 2 });
    });

    it('passes correct where clause to skontoTerm.upsert', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce({
        id: INVOICE_ID,
        organizationId: ORG_ID,
      });
      mockPrisma.skontoTerm.upsert.mockResolvedValueOnce(mockTerm);

      await caller.upsertForInvoice(input);

      const call = mockPrisma.skontoTerm.upsert.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({ invoiceId: INVOICE_ID });
      expect(call.create).toMatchObject({
        organizationId: ORG_ID,
        invoiceId: INVOICE_ID,
        discountPercent: 2,
        discountPeriodDays: 10,
        netPeriodDays: 30,
      });
    });

    it('throws NOT_FOUND when invoice does not belong to tenant', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(null);

      await expect(caller.upsertForInvoice(input)).rejects.toThrow('Invoice not found');
    });

    it('rejects when discountDays equals netDays', async () => {
      await expect(
        caller.upsertForInvoice({
          invoiceId: INVOICE_ID,
          percent: 2,
          discountDays: 30,
          netDays: 30,
        }),
      ).rejects.toThrow();
    });

    it('rejects when discountDays is greater than netDays', async () => {
      await expect(
        caller.upsertForInvoice({
          invoiceId: INVOICE_ID,
          percent: 2,
          discountDays: 31,
          netDays: 30,
        }),
      ).rejects.toThrow();
    });

    it('rejects percent above 50', async () => {
      await expect(
        caller.upsertForInvoice({
          invoiceId: INVOICE_ID,
          percent: 51,
          discountDays: 10,
          netDays: 30,
        }),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // deleteForInvoice
  // =========================================================================

  describe('deleteForInvoice', () => {
    it('deletes existing skonto term for invoice', async () => {
      mockPrisma.skontoTerm.findFirst.mockResolvedValueOnce({ id: SKONTO_TERM_ID });
      mockPrisma.skontoTerm.delete.mockResolvedValueOnce({});

      const result = await caller.deleteForInvoice({ invoiceId: INVOICE_ID });

      expect(result).toEqual({ success: true });
      expect(mockPrisma.skontoTerm.delete).toHaveBeenCalledWith({ where: { id: SKONTO_TERM_ID } });
    });

    it('passes correct where clause to skontoTerm.findFirst', async () => {
      mockPrisma.skontoTerm.findFirst.mockResolvedValueOnce({ id: SKONTO_TERM_ID });
      mockPrisma.skontoTerm.delete.mockResolvedValueOnce({});

      await caller.deleteForInvoice({ invoiceId: INVOICE_ID });

      const call = mockPrisma.skontoTerm.findFirst.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({ invoiceId: INVOICE_ID, organizationId: ORG_ID });
    });

    it('throws NOT_FOUND when no skonto term exists for invoice', async () => {
      mockPrisma.skontoTerm.findFirst.mockResolvedValueOnce(null);

      await expect(caller.deleteForInvoice({ invoiceId: INVOICE_ID })).rejects.toThrow(
        'No Skonto term found for this invoice',
      );
    });
  });

  // =========================================================================
  // upsertForBillingProfile
  // =========================================================================

  describe('upsertForBillingProfile', () => {
    const input = { billingProfileId: BILLING_PROFILE_ID, ...validTermInput };

    const mockProfileTerm = {
      ...mockTerm,
      invoiceId: null,
      billingProfileId: BILLING_PROFILE_ID,
    };

    it('upserts skonto term when billing profile belongs to tenant', async () => {
      mockPrisma.contractorBillingProfile.findFirst.mockResolvedValueOnce({
        id: BILLING_PROFILE_ID,
        organizationId: ORG_ID,
      });
      mockPrisma.skontoTerm.upsert.mockResolvedValueOnce(mockProfileTerm);

      const result = await caller.upsertForBillingProfile(input);

      expect(result).toMatchObject({ id: SKONTO_TERM_ID, billingProfileId: BILLING_PROFILE_ID });
    });

    it('passes correct create payload to skontoTerm.upsert', async () => {
      mockPrisma.contractorBillingProfile.findFirst.mockResolvedValueOnce({
        id: BILLING_PROFILE_ID,
        organizationId: ORG_ID,
      });
      mockPrisma.skontoTerm.upsert.mockResolvedValueOnce(mockProfileTerm);

      await caller.upsertForBillingProfile(input);

      const call = mockPrisma.skontoTerm.upsert.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({ billingProfileId: BILLING_PROFILE_ID });
      expect(call.create).toMatchObject({
        organizationId: ORG_ID,
        billingProfileId: BILLING_PROFILE_ID,
        invoiceId: null,
        discountPercent: 2,
        discountPeriodDays: 10,
        netPeriodDays: 30,
      });
    });

    it('throws NOT_FOUND when billing profile does not belong to tenant', async () => {
      mockPrisma.contractorBillingProfile.findFirst.mockResolvedValueOnce(null);

      await expect(caller.upsertForBillingProfile(input)).rejects.toThrow(
        'Billing profile not found',
      );
    });

    it('rejects when discountDays equals netDays', async () => {
      await expect(
        caller.upsertForBillingProfile({
          billingProfileId: BILLING_PROFILE_ID,
          percent: 2,
          discountDays: 30,
          netDays: 30,
        }),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // deleteForBillingProfile
  // =========================================================================

  describe('deleteForBillingProfile', () => {
    it('deletes existing skonto term for billing profile', async () => {
      mockPrisma.skontoTerm.findFirst.mockResolvedValueOnce({ id: SKONTO_TERM_ID });
      mockPrisma.skontoTerm.delete.mockResolvedValueOnce({});

      const result = await caller.deleteForBillingProfile({ billingProfileId: BILLING_PROFILE_ID });

      expect(result).toEqual({ success: true });
      expect(mockPrisma.skontoTerm.delete).toHaveBeenCalledWith({ where: { id: SKONTO_TERM_ID } });
    });

    it('passes correct where clause to skontoTerm.findFirst', async () => {
      mockPrisma.skontoTerm.findFirst.mockResolvedValueOnce({ id: SKONTO_TERM_ID });
      mockPrisma.skontoTerm.delete.mockResolvedValueOnce({});

      await caller.deleteForBillingProfile({ billingProfileId: BILLING_PROFILE_ID });

      const call = mockPrisma.skontoTerm.findFirst.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        billingProfileId: BILLING_PROFILE_ID,
        organizationId: ORG_ID,
      });
    });

    it('throws NOT_FOUND when no skonto term exists for billing profile', async () => {
      mockPrisma.skontoTerm.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.deleteForBillingProfile({ billingProfileId: BILLING_PROFILE_ID }),
      ).rejects.toThrow('No Skonto term found for this billing profile');
    });
  });

  // =========================================================================
  // evaluateForInvoice
  // =========================================================================

  describe('evaluateForInvoice', () => {
    const issueDate = new Date('2026-01-01');
    const mockInvoiceWithTerm = {
      id: INVOICE_ID,
      organizationId: ORG_ID,
      // Default fixture: totalMinor == amountToPayMinor (no withholding / RC-VAT).
      // The B-01 regression test below uses a separate fixture where they differ.
      totalMinor: 100_000,
      amountToPayMinor: 100_000,
      issueDate,
      paidAt: null,
      skontoTerms: [
        {
          discountPercent: 2,
          discountPeriodDays: 10,
          netPeriodDays: 30,
        },
      ],
      contractor: null,
    };

    const mockInvoiceNoTerm = {
      id: INVOICE_ID,
      organizationId: ORG_ID,
      totalMinor: 100_000,
      amountToPayMinor: 100_000,
      issueDate,
      paidAt: null,
      skontoTerms: [],
      contractor: null,
    };

    const eligibleResult = {
      eligible: true,
      eligibilityReason: 'ELIGIBLE' as const,
      discountedAmountMinor: 98_000,
      discountAmountMinor: 2_000,
      netAmountMinor: 100_000,
      discountDeadline: new Date('2026-01-11'),
    };

    const noSkontoResult = {
      eligible: false,
      eligibilityReason: 'NO_SKONTO_CONFIGURED' as const,
      discountedAmountMinor: 100_000,
      discountAmountMinor: 0,
      netAmountMinor: 100_000,
      discountDeadline: null,
    };

    it('returns eligibility result when invoice has a skonto term', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(mockInvoiceWithTerm);
      mockResolveSkontoTerm.mockReturnValueOnce({
        discountPercent: 2,
        discountPeriodDays: 10,
        netPeriodDays: 30,
      });
      mockEvaluateSkontoEligibility.mockReturnValueOnce(eligibleResult);

      const result = await caller.evaluateForInvoice({ invoiceId: INVOICE_ID });

      expect(result).toMatchObject({ eligible: true, eligibilityReason: 'ELIGIBLE' });
    });

    it('resolves skonto term using invoice-level term first', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(mockInvoiceWithTerm);
      mockResolveSkontoTerm.mockReturnValueOnce({
        discountPercent: 2,
        discountPeriodDays: 10,
        netPeriodDays: 30,
      });
      mockEvaluateSkontoEligibility.mockReturnValueOnce(eligibleResult);

      await caller.evaluateForInvoice({ invoiceId: INVOICE_ID });

      expect(mockResolveSkontoTerm).toHaveBeenCalledWith(
        { discountPercent: 2, discountPeriodDays: 10, netPeriodDays: 30 },
        null,
      );
    });

    it('passes null invoiceTerm and null profileTerm when neither is configured', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(mockInvoiceNoTerm);
      mockResolveSkontoTerm.mockReturnValueOnce(null);
      mockEvaluateSkontoEligibility.mockReturnValueOnce(noSkontoResult);

      const result = await caller.evaluateForInvoice({ invoiceId: INVOICE_ID });

      expect(result).toMatchObject({ eligible: false, eligibilityReason: 'NO_SKONTO_CONFIGURED' });
      expect(mockResolveSkontoTerm).toHaveBeenCalledWith(null, null);
    });

    it('resolves billing profile term as fallback when no invoice-level term', async () => {
      const profileSkontoTerm = { discountPercent: 3, discountPeriodDays: 7, netPeriodDays: 30 };
      const invoiceWithProfileTerm = {
        ...mockInvoiceNoTerm,
        contractor: {
          billingProfiles: [
            {
              skontoTerms: [profileSkontoTerm],
            },
          ],
        },
      };
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(invoiceWithProfileTerm);
      mockResolveSkontoTerm.mockReturnValueOnce(profileSkontoTerm);
      mockEvaluateSkontoEligibility.mockReturnValueOnce(eligibleResult);

      await caller.evaluateForInvoice({ invoiceId: INVOICE_ID });

      expect(mockResolveSkontoTerm).toHaveBeenCalledWith(null, {
        discountPercent: 3,
        discountPeriodDays: 7,
        netPeriodDays: 30,
      });
    });

    it('passes invoice financials to evaluateSkontoEligibility', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(mockInvoiceWithTerm);
      const resolvedTerm = { discountPercent: 2, discountPeriodDays: 10, netPeriodDays: 30 };
      mockResolveSkontoTerm.mockReturnValueOnce(resolvedTerm);
      mockEvaluateSkontoEligibility.mockReturnValueOnce(eligibleResult);

      await caller.evaluateForInvoice({ invoiceId: INVOICE_ID });

      const call = mockEvaluateSkontoEligibility.mock.calls[0]?.[0];
      expect(call).toMatchObject({
        invoiceTotalMinor: 100_000,
        invoiceIssueDate: issueDate,
        skontoTerm: resolvedTerm,
        paidAt: null,
      });
      expect(call.asOf).toBeInstanceOf(Date);
    });

    it('uses invoice.amountToPayMinor (not totalMinor) as the Skonto basis — B-01 regression', async () => {
      // Withholding case: an invoice where totalMinor and amountToPayMinor
      // diverge (e.g. supplier-side withholding tax deducted at source, or
      // reverse-charge VAT). The Skonto basis MUST track amountToPayMinor so
      // that skonto.evaluateForInvoice and payment.applySkontoToItem agree on
      // the basis for the same invoice. This test would have caught CR-02 in
      // the v5.0 audit (see .planning/phases/63-uk-payments-financial-features/
      // 63-VERIFICATION.md and Phase 65 CONTEXT.md decision D-03 / B-01).
      const totalMinor = 120_000; // gross invoice
      const amountToPayMinor = 100_000; // after €20 supplier withholding
      expect(totalMinor).not.toBe(amountToPayMinor); // sanity: fixture exposes the bug surface

      const withholdingInvoice = {
        ...mockInvoiceWithTerm,
        totalMinor,
        amountToPayMinor,
      };
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(withholdingInvoice);
      const resolvedTerm = { discountPercent: 2, discountPeriodDays: 10, netPeriodDays: 30 };
      mockResolveSkontoTerm.mockReturnValueOnce(resolvedTerm);
      mockEvaluateSkontoEligibility.mockReturnValueOnce(eligibleResult);

      await caller.evaluateForInvoice({ invoiceId: INVOICE_ID });

      // CRITICAL: must equal amountToPayMinor, not totalMinor.
      expect(mockEvaluateSkontoEligibility).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceTotalMinor: amountToPayMinor }),
      );
      expect(mockEvaluateSkontoEligibility).not.toHaveBeenCalledWith(
        expect.objectContaining({ invoiceTotalMinor: totalMinor }),
      );
    });

    it('passes correct where clause when querying invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(mockInvoiceWithTerm);
      mockResolveSkontoTerm.mockReturnValueOnce(null);
      mockEvaluateSkontoEligibility.mockReturnValueOnce(noSkontoResult);

      await caller.evaluateForInvoice({ invoiceId: INVOICE_ID });

      const call = mockPrisma.invoice.findFirst.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({ id: INVOICE_ID, organizationId: ORG_ID });
    });

    it('throws NOT_FOUND when invoice does not belong to tenant', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(null);

      await expect(caller.evaluateForInvoice({ invoiceId: 'nonexistent' })).rejects.toThrow(
        'Invoice not found',
      );
    });
  });
});

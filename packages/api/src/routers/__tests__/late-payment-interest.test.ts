/**
 * Unit tests for latePaymentInterestRouter.
 *
 * Covers: getForInvoice, getForOrg, waive, revokeWaiver, claim, downloadClaim.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-lpi-001';
const USER_ID = 'user-lpi-001';
const INVOICE_ID = 'inv-lpi-001';
const WAIVER_ID = 'waiver-lpi-001';
const CLAIM_ID = 'claim-lpi-001';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockCalculateLateInterest,
  mockGetCompensationTier,
  mockLoadBoeRateHistory,
  mockSignExistingDownload,
} = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ dataRegion: 'EU' }),
    },
    invoice: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    invoiceInterestCompensation: {
      upsert: vi.fn(),
    },
    invoiceInterestWaiver: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    invoiceInterestClaim: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    member: {
      findFirst: vi.fn().mockResolvedValue({ role: 'admin' }),
    },
    $transaction: vi.fn(async (fnOrArray: ((tx: Rec) => Promise<unknown>) | unknown[]) => {
      if (typeof fnOrArray === 'function') return fnOrArray(mockPrisma);
      return Promise.all(fnOrArray);
    }),
  };

  return {
    mockPrisma,
    mockCalculateLateInterest: vi.fn(),
    mockGetCompensationTier: vi.fn().mockReturnValue(7_000),
    mockLoadBoeRateHistory: vi
      .fn()
      .mockResolvedValue([{ effectiveFrom: new Date('2023-01-01'), ratePercent: 5.25 }]),
    mockSignExistingDownload: vi
      .fn()
      .mockResolvedValue({ signedUrl: 'https://r2.example.com/signed' }),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
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

vi.mock('@contractor-ops/feature-flags', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/feature-flags')>();
  return {
    ...actual,
    lazyFlagBag: () => ({
      values: {},
      isEnabled: () => true,
    }),
  };
});

vi.mock('@contractor-ops/validators', async importOriginal => ({
  ...(await importOriginal()),
}));

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

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('../../services/boe-rate-cache.js', () => ({
  loadBoeRateHistory: mockLoadBoeRateHistory,
  invalidateBoeRateCache: vi.fn(),
  __resetBoeRateCacheForTests: vi.fn(),
}));

vi.mock('../../services/late-payment-interest.js', () => ({
  calculateLateInterest: mockCalculateLateInterest,
  getCompensationTier: mockGetCompensationTier,
}));

vi.mock('../../services/r2.js', () => ({
  signExistingDownload: mockSignExistingDownload,
}));

vi.mock('@contractor-ops/integrations/services/qstash-client', () => ({
  getQStashClient: vi.fn(() => ({
    publishJSON: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init.js';
import { latePaymentInterestRouter } from '../late-payment-interest.js';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(latePaymentInterestRouter);

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
      name: 'LPI User',
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

function makeGbInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE_ID,
    organizationId: ORG_ID,
    contractorId: 'contractor-001',
    invoiceNumber: 'INV-001',
    currency: 'GBP',
    totalMinor: 500_000,
    dueDate: new Date('2024-01-01'),
    paidAt: null,
    paymentStatus: 'UNPAID',
    deletedAt: null,
    contractor: {
      id: 'contractor-001',
      countryCode: 'GB',
      isBusinessCustomer: true,
    },
    organization: { id: ORG_ID, name: 'Test Org' },
    payments: [],
    interestCompensation: null,
    interestWaivers: [],
    interestClaims: [],
    ...overrides,
  };
}

function makeApplicableResult(overrides: Record<string, unknown> = {}) {
  return {
    applicable: true,
    daysOverdue: 90,
    principalOutstandingMinor: 500_000,
    rateUsed: 13.25,
    dailyInterestMinor: 181,
    accruedInterestMinor: 16_290,
    compensationTierMinor: 7_000,
    totalClaimMinor: 23_290,
    waiverApplied: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadBoeRateHistory.mockResolvedValue([
    { effectiveFrom: new Date('2023-01-01'), ratePercent: 5.25 },
  ]);
  mockGetCompensationTier.mockReturnValue(7_000);
  mockCalculateLateInterest.mockReturnValue(makeApplicableResult());
  mockSignExistingDownload.mockResolvedValue({ signedUrl: 'https://r2.example.com/signed' });
});

// ===========================================================================
// Tests
// ===========================================================================

describe('latePaymentInterestRouter', () => {
  // =========================================================================
  // getForInvoice
  // =========================================================================

  describe('getForInvoice', () => {
    it('returns interest result for a valid GB B2B invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(makeGbInvoice());

      const result = await caller.getForInvoice({ invoiceId: INVOICE_ID });

      expect(result).toMatchObject({
        applicable: true,
        daysOverdue: 90,
        waiverStatus: 'NONE',
        claimStatus: 'NONE',
      });
    });

    it('throws NOT_FOUND when invoice does not exist', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(null);

      await expect(caller.getForInvoice({ invoiceId: 'nonexistent' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('returns applicable=false when contractor is missing', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(makeGbInvoice({ contractor: null }));

      const result = await caller.getForInvoice({ invoiceId: INVOICE_ID });

      expect(result).toMatchObject({ applicable: false, reason: 'NO_CONTRACTOR' });
    });

    it('returns applicable=false for non-GB contractor', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(
        makeGbInvoice({ contractor: { id: 'c1', countryCode: 'DE', isBusinessCustomer: true } }),
      );

      const result = await caller.getForInvoice({ invoiceId: INVOICE_ID });

      expect(result).toMatchObject({ applicable: false, reason: 'NON_GB_INVOICE' });
    });

    it('returns applicable=false for B2C transaction', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(
        makeGbInvoice({ contractor: { id: 'c1', countryCode: 'GB', isBusinessCustomer: false } }),
      );

      const result = await caller.getForInvoice({ invoiceId: INVOICE_ID });

      expect(result).toMatchObject({ applicable: false, reason: 'B2C_TRANSACTION' });
    });

    it('returns applicable=false for non-GBP currency', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(makeGbInvoice({ currency: 'EUR' }));

      const result = await caller.getForInvoice({ invoiceId: INVOICE_ID });

      expect(result).toMatchObject({ applicable: false, reason: 'NON_GBP_CURRENCY' });
    });

    it('upserts compensation record when invoice is overdue and no compensation exists', async () => {
      const overdueInvoice = makeGbInvoice({
        dueDate: new Date('2023-01-01'),
        interestCompensation: null,
      });
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(overdueInvoice);
      mockPrisma.invoiceInterestCompensation.upsert.mockResolvedValueOnce({
        id: 'comp-001',
        tierMinor: 7_000,
        invoiceId: INVOICE_ID,
      });

      await caller.getForInvoice({ invoiceId: INVOICE_ID });

      expect(mockPrisma.invoiceInterestCompensation.upsert).toHaveBeenCalledOnce();
      expect(mockPrisma.invoiceInterestCompensation.upsert.mock.calls[0]?.[0]).toMatchObject({
        where: { invoiceId: INVOICE_ID },
        create: expect.objectContaining({ organizationId: ORG_ID, invoiceId: INVOICE_ID }),
      });
    });

    it('does not upsert compensation when compensation record already exists', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(
        makeGbInvoice({
          dueDate: new Date('2023-01-01'),
          interestCompensation: { id: 'comp-001', tierMinor: 7_000 },
        }),
      );

      await caller.getForInvoice({ invoiceId: INVOICE_ID });

      expect(mockPrisma.invoiceInterestCompensation.upsert).not.toHaveBeenCalled();
    });

    it('calls calculateLateInterest with correct principal and rate history', async () => {
      const rateHistory = [{ effectiveFrom: new Date('2023-01-01'), ratePercent: 5.25 }];
      mockLoadBoeRateHistory.mockResolvedValueOnce(rateHistory);
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(makeGbInvoice());

      await caller.getForInvoice({ invoiceId: INVOICE_ID });

      expect(mockCalculateLateInterest).toHaveBeenCalledOnce();
      const args = mockCalculateLateInterest.mock.calls[0]?.[0];
      expect(args).toMatchObject({
        invoiceTotalMinor: 500_000,
        currency: 'GBP',
        contractorCountryCode: 'GB',
        isBusinessCustomer: true,
      });
      expect(args.rateHistory).toEqual([
        { effectiveFrom: rateHistory[0]?.effectiveFrom, ratePercent: 5.25 },
      ]);
    });

    it('surfaces waiverStatus=WAIVED when active waiver exists', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(
        makeGbInvoice({
          interestWaivers: [
            {
              id: WAIVER_ID,
              waiveType: 'STATUTORY_INTEREST',
              reason: 'goodwill',
              waivedAt: new Date(),
              revokedAt: null,
            },
          ],
        }),
      );

      const result = await caller.getForInvoice({ invoiceId: INVOICE_ID });

      expect(result).toMatchObject({ waiverStatus: 'WAIVED' });
      expect(result.waivers).toHaveLength(1);
    });

    it('surfaces claimStatus=CLAIMED when claim exists', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(
        makeGbInvoice({
          interestClaims: [
            {
              id: CLAIM_ID,
              claimedAt: new Date(),
              snapshotInterestMinor: 16_290,
              snapshotCompensationMinor: 7_000,
              pdfStatus: 'READY',
              pdfReadyAt: new Date(),
              pdfError: null,
            },
          ],
        }),
      );

      const result = await caller.getForInvoice({ invoiceId: INVOICE_ID });

      expect(result).toMatchObject({ claimStatus: 'CLAIMED' });
      expect(result.claims).toHaveLength(1);
    });

    it('passes payments array to calculateLateInterest', async () => {
      const pmt = { amountMinor: 100_000, paidAt: new Date('2024-06-01') };
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(makeGbInvoice({ payments: [pmt] }));

      await caller.getForInvoice({ invoiceId: INVOICE_ID });

      const args = mockCalculateLateInterest.mock.calls[0]?.[0];
      expect(args.payments).toEqual([{ amountMinor: pmt.amountMinor, paidAt: pmt.paidAt }]);
    });
  });

  // =========================================================================
  // getForOrg
  // =========================================================================

  describe('getForOrg', () => {
    it('returns a list of overdue GB B2B invoices with computed interest', async () => {
      const invoice = makeGbInvoice({ dueDate: new Date('2023-06-01') });
      mockPrisma.invoice.findMany.mockResolvedValueOnce([invoice]);

      const result = await caller.getForOrg({});

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
      expect(result.items[0]).toMatchObject({
        invoiceId: INVOICE_ID,
        applicable: true,
      });
    });

    it('filters by status=ACCRUING when requested', async () => {
      const accruingInvoice = makeGbInvoice({ id: 'inv-a', dueDate: new Date('2023-06-01') });
      const claimedInvoice = makeGbInvoice({
        id: 'inv-b',
        dueDate: new Date('2023-05-01'),
        interestClaims: [{ id: 'cl-1' }],
      });
      mockPrisma.invoice.findMany.mockResolvedValueOnce([accruingInvoice, claimedInvoice]);

      const result = await caller.getForOrg({ status: 'ACCRUING' });

      const statuses = result.items.map((i: { status: string }) => i.status);
      expect(statuses.every((s: string) => s === 'ACCRUING')).toBe(true);
    });

    it('returns nextCursor when more items exist', async () => {
      const invoices = Array.from({ length: 21 }, (_, i) =>
        makeGbInvoice({
          id: `inv-${i}`,
          invoiceNumber: `INV-${i}`,
          dueDate: new Date('2023-06-01'),
        }),
      );
      mockPrisma.invoice.findMany.mockResolvedValueOnce(invoices);

      const result = await caller.getForOrg({});

      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).toBe('inv-19');
    });

    it('queries only for organizationId-scoped GB B2B invoices', async () => {
      mockPrisma.invoice.findMany.mockResolvedValueOnce([]);

      await caller.getForOrg({});

      const call = mockPrisma.invoice.findMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        organizationId: ORG_ID,
        currency: 'GBP',
        contractor: { countryCode: 'GB', isBusinessCustomer: true },
      });
    });

    it('loads BoE rate history once for all items', async () => {
      const invoices = [makeGbInvoice(), makeGbInvoice({ id: 'inv-2', invoiceNumber: 'INV-2' })];
      mockPrisma.invoice.findMany.mockResolvedValueOnce(invoices);

      await caller.getForOrg({});

      expect(mockLoadBoeRateHistory).toHaveBeenCalledOnce();
    });

    it('correctly marks invoices with active waivers as WAIVED', async () => {
      const waivedInvoice = makeGbInvoice({
        dueDate: new Date('2023-06-01'),
        interestWaivers: [{ waiveType: 'BOTH', revokedAt: null }],
      });
      mockPrisma.invoice.findMany.mockResolvedValueOnce([waivedInvoice]);

      const result = await caller.getForOrg({});

      expect(result.items[0]).toMatchObject({ status: 'WAIVED' });
    });
  });

  // =========================================================================
  // waive
  // =========================================================================

  describe('waive', () => {
    it('creates a waiver record and returns waiverId', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce({ id: INVOICE_ID });
      mockPrisma.invoiceInterestWaiver.findFirst.mockResolvedValueOnce(null);
      mockPrisma.invoiceInterestWaiver.create.mockResolvedValueOnce({ id: WAIVER_ID });

      const result = await caller.waive({
        invoiceId: INVOICE_ID,
        waiveType: 'STATUTORY_INTEREST',
        reason: 'Customer goodwill gesture',
      });

      expect(result).toEqual({ waiverId: WAIVER_ID });
    });

    it('throws NOT_FOUND when invoice does not belong to org', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.waive({
          invoiceId: 'foreign-inv',
          waiveType: 'STATUTORY_INTEREST',
          reason: 'Customer goodwill gesture',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws CONFLICT when active waiver of same type already exists', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce({ id: INVOICE_ID });
      mockPrisma.invoiceInterestWaiver.findFirst.mockResolvedValueOnce({
        id: 'existing-waiver',
        waiveType: 'STATUTORY_INTEREST',
        revokedAt: null,
      });

      await expect(
        caller.waive({
          invoiceId: INVOICE_ID,
          waiveType: 'STATUTORY_INTEREST',
          reason: 'Customer goodwill gesture',
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('creates waiver with correct waiveType and organizationId', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce({ id: INVOICE_ID });
      mockPrisma.invoiceInterestWaiver.findFirst.mockResolvedValueOnce(null);
      mockPrisma.invoiceInterestWaiver.create.mockResolvedValueOnce({ id: WAIVER_ID });

      await caller.waive({
        invoiceId: INVOICE_ID,
        waiveType: 'COMPENSATION',
        reason: 'Agreed with customer in writing',
      });

      expect(mockPrisma.invoiceInterestWaiver.create.mock.calls[0]?.[0]).toMatchObject({
        data: {
          organizationId: ORG_ID,
          invoiceId: INVOICE_ID,
          waiveType: 'COMPENSATION',
          waivedByUserId: USER_ID,
        },
      });
    });

    it('rejects reason shorter than 10 characters', async () => {
      await expect(
        caller.waive({
          invoiceId: INVOICE_ID,
          waiveType: 'BOTH',
          reason: 'short',
        }),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // revokeWaiver
  // =========================================================================

  describe('revokeWaiver', () => {
    it('revokes an existing active waiver', async () => {
      mockPrisma.invoiceInterestWaiver.findFirst.mockResolvedValueOnce({
        id: WAIVER_ID,
        invoiceId: INVOICE_ID,
        revokedAt: null,
      });
      mockPrisma.invoiceInterestWaiver.update.mockResolvedValueOnce({ id: WAIVER_ID });

      const result = await caller.revokeWaiver({
        waiverId: WAIVER_ID,
        revokeReason: 'Correcting admin error',
      });

      expect(result).toEqual({ revoked: true });
    });

    it('throws NOT_FOUND when waiver does not exist', async () => {
      mockPrisma.invoiceInterestWaiver.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.revokeWaiver({
          waiverId: 'nonexistent-waiver',
          revokeReason: 'Correcting admin error',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws NOT_FOUND when waiver is already revoked', async () => {
      mockPrisma.invoiceInterestWaiver.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.revokeWaiver({
          waiverId: WAIVER_ID,
          revokeReason: 'Correcting admin error',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('updates waiver with revokedAt and revokedByUserId', async () => {
      mockPrisma.invoiceInterestWaiver.findFirst.mockResolvedValueOnce({
        id: WAIVER_ID,
        invoiceId: INVOICE_ID,
        revokedAt: null,
      });
      mockPrisma.invoiceInterestWaiver.update.mockResolvedValueOnce({ id: WAIVER_ID });

      await caller.revokeWaiver({
        waiverId: WAIVER_ID,
        revokeReason: 'Correcting admin error',
      });

      expect(mockPrisma.invoiceInterestWaiver.update.mock.calls[0]?.[0]).toMatchObject({
        where: { id: WAIVER_ID },
        data: {
          revokedByUserId: USER_ID,
          revokeReason: 'Correcting admin error',
        },
      });
    });

    it('rejects revokeReason shorter than 10 characters', async () => {
      await expect(
        caller.revokeWaiver({ waiverId: WAIVER_ID, revokeReason: 'too short' }),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // claim
  // =========================================================================

  describe('claim', () => {
    it('creates a claim record and returns claimId with PENDING_RENDER status', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(makeGbInvoice());
      mockPrisma.invoiceInterestClaim.create.mockResolvedValueOnce({
        id: CLAIM_ID,
        pdfStatus: 'PENDING_RENDER',
      });

      const result = await caller.claim({ invoiceId: INVOICE_ID, issueAsSecondaryInvoice: false });

      expect(result).toMatchObject({
        claimId: CLAIM_ID,
        pdfStatus: 'PENDING_RENDER',
        pdfUrl: null,
        secondaryInvoiceId: null,
      });
    });

    it('throws NOT_FOUND when invoice does not exist', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.claim({ invoiceId: 'nonexistent', issueAsSecondaryInvoice: false }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws CONFLICT when interest has already been claimed', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(
        makeGbInvoice({ interestClaims: [{ id: 'existing-claim' }] }),
      );

      await expect(
        caller.claim({ invoiceId: INVOICE_ID, issueAsSecondaryInvoice: false }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('throws PRECONDITION_FAILED when calculateLateInterest returns applicable=false', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(makeGbInvoice());
      mockCalculateLateInterest.mockReturnValueOnce({
        applicable: false,
        reason: 'NON_GB_INVOICE',
        totalClaimMinor: 0,
      });

      await expect(
        caller.claim({ invoiceId: INVOICE_ID, issueAsSecondaryInvoice: false }),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    });

    it('throws PRECONDITION_FAILED when totalClaimMinor is zero', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(makeGbInvoice());
      mockCalculateLateInterest.mockReturnValueOnce(makeApplicableResult({ totalClaimMinor: 0 }));

      await expect(
        caller.claim({ invoiceId: INVOICE_ID, issueAsSecondaryInvoice: false }),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    });

    it('creates secondary invoice when issueAsSecondaryInvoice=true', async () => {
      const secondaryId = 'sec-inv-001';
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(makeGbInvoice());
      mockPrisma.invoice.create.mockResolvedValueOnce({ id: secondaryId });
      mockPrisma.invoiceInterestClaim.create.mockResolvedValueOnce({
        id: CLAIM_ID,
        pdfStatus: 'PENDING_RENDER',
      });

      const result = await caller.claim({ invoiceId: INVOICE_ID, issueAsSecondaryInvoice: true });

      expect(result.secondaryInvoiceId).toBe(secondaryId);
      expect(mockPrisma.invoice.create).toHaveBeenCalledOnce();
      expect(mockPrisma.invoice.create.mock.calls[0]?.[0]).toMatchObject({
        data: {
          organizationId: ORG_ID,
          invoiceNumber: `LPC-INV-001`,
          source: 'LATE_INTEREST_CLAIM',
          currency: 'GBP',
        },
      });
    });

    it('stores snapshotInterestMinor and snapshotCompensationMinor on claim', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(makeGbInvoice());
      mockPrisma.invoiceInterestClaim.create.mockResolvedValueOnce({
        id: CLAIM_ID,
        pdfStatus: 'PENDING_RENDER',
      });

      await caller.claim({ invoiceId: INVOICE_ID, issueAsSecondaryInvoice: false });

      expect(mockPrisma.invoiceInterestClaim.create.mock.calls[0]?.[0]).toMatchObject({
        data: {
          snapshotInterestMinor: 16_290,
          snapshotCompensationMinor: 7_000,
          pdfStatus: 'PENDING_RENDER',
          pdfKey: null,
        },
      });
    });

    it('passes correct args to calculateLateInterest in claim path', async () => {
      const rateHistory = [{ effectiveFrom: new Date('2023-01-01'), ratePercent: 5.25 }];
      mockLoadBoeRateHistory.mockResolvedValueOnce(rateHistory);
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(makeGbInvoice());
      mockPrisma.invoiceInterestClaim.create.mockResolvedValueOnce({
        id: CLAIM_ID,
        pdfStatus: 'PENDING_RENDER',
      });

      await caller.claim({ invoiceId: INVOICE_ID, issueAsSecondaryInvoice: false });

      const args = mockCalculateLateInterest.mock.calls[0]?.[0];
      expect(args).toMatchObject({
        invoiceTotalMinor: 500_000,
        contractorCountryCode: 'GB',
        isBusinessCustomer: true,
      });
    });
  });

  // =========================================================================
  // downloadClaim
  // =========================================================================

  describe('downloadClaim', () => {
    it('returns signedUrl when PDF is ready', async () => {
      mockPrisma.invoiceInterestClaim.findFirst.mockResolvedValueOnce({
        id: CLAIM_ID,
        organizationId: ORG_ID,
        pdfStatus: 'READY',
        pdfKey: 'orgs/org-lpi-001/claims/claim-lpi-001.pdf',
        pdfError: null,
        invoice: { invoiceNumber: 'INV-001' },
      });

      const result = await caller.downloadClaim({ claimId: CLAIM_ID });

      expect(result).toMatchObject({
        pdfStatus: 'READY',
        downloadUrl: 'https://r2.example.com/signed',
        pdfError: null,
      });
    });

    it('throws NOT_FOUND when claim does not exist', async () => {
      mockPrisma.invoiceInterestClaim.findFirst.mockResolvedValueOnce(null);

      await expect(caller.downloadClaim({ claimId: 'nonexistent' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('returns pdfStatus without URL when PDF is still PENDING_RENDER', async () => {
      mockPrisma.invoiceInterestClaim.findFirst.mockResolvedValueOnce({
        id: CLAIM_ID,
        organizationId: ORG_ID,
        pdfStatus: 'PENDING_RENDER',
        pdfKey: null,
        pdfError: null,
        invoice: { invoiceNumber: 'INV-001' },
      });

      const result = await caller.downloadClaim({ claimId: CLAIM_ID });

      expect(result).toMatchObject({ pdfStatus: 'PENDING_RENDER', downloadUrl: null });
      expect(mockSignExistingDownload).not.toHaveBeenCalled();
    });

    it('returns pdfError when PDF render failed', async () => {
      mockPrisma.invoiceInterestClaim.findFirst.mockResolvedValueOnce({
        id: CLAIM_ID,
        organizationId: ORG_ID,
        pdfStatus: 'FAILED',
        pdfKey: null,
        pdfError: 'Render timeout',
        invoice: { invoiceNumber: 'INV-001' },
      });

      const result = await caller.downloadClaim({ claimId: CLAIM_ID });

      expect(result).toMatchObject({
        pdfStatus: 'FAILED',
        pdfError: 'Render timeout',
        downloadUrl: null,
      });
    });

    it('calls signExistingDownload with correct key and filename', async () => {
      const pdfKey = 'orgs/org-lpi-001/claims/claim-lpi-001.pdf';
      mockPrisma.invoiceInterestClaim.findFirst.mockResolvedValueOnce({
        id: CLAIM_ID,
        organizationId: ORG_ID,
        pdfStatus: 'READY',
        pdfKey,
        pdfError: null,
        invoice: { invoiceNumber: 'INV-001' },
      });

      await caller.downloadClaim({ claimId: CLAIM_ID });

      expect(mockSignExistingDownload).toHaveBeenCalledWith(
        pdfKey,
        300,
        'late-payment-claim-INV-001.pdf',
      );
    });

    it('scopes claim lookup to the caller org', async () => {
      mockPrisma.invoiceInterestClaim.findFirst.mockResolvedValueOnce(null);

      await expect(caller.downloadClaim({ claimId: CLAIM_ID })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });

      const call = mockPrisma.invoiceInterestClaim.findFirst.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({ id: CLAIM_ID, organizationId: ORG_ID });
    });
  });
});

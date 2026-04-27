/**
 * ZATCA router unit tests.
 *
 * Tests saveTaxDetails, generateCsr, requestComplianceCsid,
 * runComplianceChecks, exchangeProductionCert, getOnboardingState,
 * getStatus, getInvoiceChain, resubmit, and getComplianceStats.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-zatca-001';
const USER_ID = 'user-zatca-001';
const INVOICE_ID = 'inv-zatca-001';

// ---------------------------------------------------------------------------
// Mock services via vi.hoisted
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockSaveTaxDetails,
  mockGenerateAndStoreCsr,
  mockRequestComplianceCsid,
  mockRunComplianceChecks,
  mockExchangeProductionCertificate,
  mockGetOnboardingState,
  mockQueueZatcaSubmission,
} = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ dataRegion: 'EU' }),
    },
    zatcaInvoiceChain: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    member: {
      findFirst: vi.fn().mockResolvedValue({ role: 'admin' }),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (fnOrArray: ((tx: Rec) => Promise<unknown>) | unknown[]) => {
      if (typeof fnOrArray === 'function') return fnOrArray(mockPrisma);
      return Promise.all(fnOrArray);
    }),
  };

  return {
    mockPrisma,
    mockSaveTaxDetails: vi.fn(async () => undefined),
    mockGenerateAndStoreCsr: vi.fn(async () => ({ csrPem: '-----BEGIN CERTIFICATE REQUEST-----' })),
    mockRequestComplianceCsid: vi.fn(async () => ({
      csid: 'compliance-csid-123',
      expiresAt: '2027-01-01',
    })),
    mockRunComplianceChecks: vi.fn(async () => ({
      results: [
        { type: 'STANDARD', subType: 'CLEARED', status: 'CLEARED' },
        { type: 'SIMPLIFIED', subType: 'REPORTED', status: 'REPORTED' },
      ],
      allPassed: true,
    })),
    mockExchangeProductionCertificate: vi.fn(async () => undefined),
    mockGetOnboardingState: vi.fn(async () => ({
      currentStep: 1,
      taxDetailsComplete: true,
      csrGenerated: false,
      complianceCsidObtained: false,
      complianceChecksPassed: false,
      productionCertObtained: false,
    })),
    mockQueueZatcaSubmission: vi.fn(async () => undefined),
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

vi.mock('@contractor-ops/einvoice', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/einvoice')>();
  return { ...actual };
});

vi.mock('../../services/zatca-onboarding.js', () => ({
  saveTaxDetails: mockSaveTaxDetails,
  generateAndStoreCsr: mockGenerateAndStoreCsr,
  requestComplianceCsid: mockRequestComplianceCsid,
  runComplianceChecks: mockRunComplianceChecks,
  exchangeProductionCertificate: mockExchangeProductionCertificate,
  getOnboardingState: mockGetOnboardingState,
}));

vi.mock('../../services/zatca-submission.js', () => ({
  queueZatcaSubmission: mockQueueZatcaSubmission,
}));

vi.mock('../../services/cache.js', () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {},
  CacheTTL: {},
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init.js';
import { zatcaRouter } from '../compliance/zatca.js';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(zatcaRouter);

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
      name: 'ZATCA User',
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
});

// ===========================================================================
// Tests
// ===========================================================================

describe('zatcaRouter', () => {
  // =========================================================================
  // saveTaxDetails
  // =========================================================================

  describe('saveTaxDetails', () => {
    const validTaxDetails = {
      vatNumber: '300000000000003',
      orgNameArabic: '\u0634\u0631\u0643\u0629 \u0627\u062E\u062A\u0628\u0627\u0631',
      street: '\u0634\u0627\u0631\u0639 \u0627\u0644\u0645\u0644\u0643',
      city: '\u0627\u0644\u0631\u064A\u0627\u0636',
      district: '\u0627\u0644\u0639\u0644\u064A\u0627',
      postalCode: '12345',
      invoiceTypes: ['standard' as const],
    };

    it('calls saveTaxDetails service with org ID and input', async () => {
      const result = await caller.saveTaxDetails({ taxDetails: validTaxDetails });

      expect(result).toEqual({ success: true });
      expect(mockSaveTaxDetails).toHaveBeenCalledWith(ORG_ID, validTaxDetails);
    });

    it('calls service exactly once per invocation', async () => {
      await caller.saveTaxDetails({ taxDetails: validTaxDetails });

      expect(mockSaveTaxDetails).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // generateCsr
  // =========================================================================

  describe('generateCsr', () => {
    it('calls generateAndStoreCsr with org ID', async () => {
      const result = await caller.generateCsr();

      expect(result).toMatchObject({ csrPem: expect.any(String) });
      expect(mockGenerateAndStoreCsr).toHaveBeenCalledWith(ORG_ID);
    });
  });

  // =========================================================================
  // requestComplianceCsid
  // =========================================================================

  describe('requestComplianceCsid', () => {
    it('returns compliance CSID from service', async () => {
      const result = await caller.requestComplianceCsid();

      expect(result).toMatchObject({ csid: 'compliance-csid-123' });
      expect(mockRequestComplianceCsid).toHaveBeenCalledWith(ORG_ID);
    });
  });

  // =========================================================================
  // runComplianceChecks
  // =========================================================================

  describe('runComplianceChecks', () => {
    it('returns compliance check results', async () => {
      const result = await caller.runComplianceChecks();

      expect(result).toMatchObject({ allPassed: true });
      expect(result.results).toHaveLength(2);
      expect(mockRunComplianceChecks).toHaveBeenCalledWith(ORG_ID);
    });
  });

  // =========================================================================
  // exchangeProductionCert
  // =========================================================================

  describe('exchangeProductionCert', () => {
    it('exchanges compliance CSID for production cert', async () => {
      const result = await caller.exchangeProductionCert();

      expect(result).toEqual({ success: true });
      expect(mockExchangeProductionCertificate).toHaveBeenCalledWith(ORG_ID);
    });
  });

  // =========================================================================
  // getOnboardingState
  // =========================================================================

  describe('getOnboardingState', () => {
    it('returns current onboarding wizard state', async () => {
      const result = await caller.getOnboardingState();

      expect(result).toMatchObject({
        currentStep: 1,
        taxDetailsComplete: true,
        csrGenerated: false,
      });
      expect(mockGetOnboardingState).toHaveBeenCalledWith(ORG_ID);
    });
  });

  // =========================================================================
  // getStatus
  // =========================================================================

  describe('getStatus', () => {
    it('returns ZATCA submission status for an invoice', async () => {
      mockPrisma.zatcaInvoiceChain.findFirst.mockResolvedValueOnce({
        id: 'chain-1',
        icv: 1,
        zatcaUuid: 'uuid-123',
        zatcaStatus: 'CLEARED',
        submittedAt: new Date(),
        clearedAt: new Date(),
        reportedAt: null,
        rejectedAt: null,
        rejectionReason: null,
        createdAt: new Date(),
        invoiceHash: 'hash-abc',
        previousHash: 'hash-000',
        zatcaResponse: {},
      });

      const result = await caller.getStatus({ invoiceId: INVOICE_ID });

      expect(result).toMatchObject({ id: 'chain-1', zatcaStatus: 'CLEARED' });

      const call = mockPrisma.zatcaInvoiceChain.findFirst.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        invoiceId: INVOICE_ID,
        organizationId: ORG_ID,
      });
    });

    it('returns null when no chain entry exists', async () => {
      mockPrisma.zatcaInvoiceChain.findFirst.mockResolvedValueOnce(null);

      const result = await caller.getStatus({ invoiceId: 'nonexistent' });

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // getInvoiceChain
  // =========================================================================

  describe('getInvoiceChain', () => {
    it('returns paginated chain entries ordered by ICV desc', async () => {
      const entries = [
        {
          id: 'c1',
          icv: 3,
          invoiceId: 'inv-3',
          zatcaUuid: 'u3',
          zatcaStatus: 'CLEARED',
          submittedAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: 'c2',
          icv: 2,
          invoiceId: 'inv-2',
          zatcaUuid: 'u2',
          zatcaStatus: 'REPORTED',
          submittedAt: new Date(),
          createdAt: new Date(),
        },
      ];
      mockPrisma.zatcaInvoiceChain.findMany.mockResolvedValueOnce(entries);

      const result = await caller.getInvoiceChain({ limit: 20 });

      expect(result.entries).toHaveLength(2);
      expect(result.nextCursor).toBeUndefined();

      const call = mockPrisma.zatcaInvoiceChain.findMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({ organizationId: ORG_ID });
      expect(call.orderBy).toMatchObject({ icv: 'desc' });
    });

    it('returns nextCursor when more items exist', async () => {
      // Request limit=2, return 3 items (hasMore=true)
      const entries = [
        { id: 'c1', icv: 3 },
        { id: 'c2', icv: 2 },
        { id: 'c3', icv: 1 },
      ];
      mockPrisma.zatcaInvoiceChain.findMany.mockResolvedValueOnce(entries);

      const result = await caller.getInvoiceChain({ limit: 2 });

      expect(result.entries).toHaveLength(2);
      expect(result.nextCursor).toBe('c2');
    });
  });

  // =========================================================================
  // resubmit
  // =========================================================================

  describe('resubmit', () => {
    it('queues resubmission for rejected invoice', async () => {
      mockPrisma.zatcaInvoiceChain.findFirst.mockResolvedValueOnce({
        id: 'chain-1',
        invoiceId: INVOICE_ID,
        organizationId: ORG_ID,
        zatcaStatus: 'REJECTED',
      });

      const result = await caller.resubmit({ invoiceId: INVOICE_ID });

      expect(result).toEqual({ queued: true });
      expect(mockQueueZatcaSubmission).toHaveBeenCalledWith(INVOICE_ID, ORG_ID);
    });

    it('throws when invoice is not eligible for resubmission', async () => {
      mockPrisma.zatcaInvoiceChain.findFirst.mockResolvedValueOnce(null);

      await expect(caller.resubmit({ invoiceId: 'nonexistent' })).rejects.toThrow(
        'Invoice not found or not eligible for resubmission',
      );
    });
  });

  // =========================================================================
  // getComplianceStats
  // =========================================================================

  describe('getComplianceStats', () => {
    it('returns counts by ZATCA status', async () => {
      mockPrisma.zatcaInvoiceChain.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(60) // cleared
        .mockResolvedValueOnce(20) // reported
        .mockResolvedValueOnce(5) // rejected
        .mockResolvedValueOnce(10) // pending
        .mockResolvedValueOnce(5); // warning

      const result = await caller.getComplianceStats();

      expect(result).toEqual({
        total: 100,
        cleared: 60,
        reported: 20,
        rejected: 5,
        pending: 10,
        warning: 5,
      });
    });

    it('returns zeros when no invoices exist', async () => {
      mockPrisma.zatcaInvoiceChain.count.mockResolvedValue(0);

      const result = await caller.getComplianceStats();

      expect(result).toEqual({
        total: 0,
        cleared: 0,
        reported: 0,
        rejected: 0,
        pending: 0,
        warning: 0,
      });
    });
  });
});

/**
 * Contractor router unit tests.
 *
 * Strategy:
 *  - Mock `@contractor-ops/db` with a vi.hoisted mockPrisma.
 *  - Mock `@contractor-ops/auth`, service modules, logger, Sentry.
 *  - Create a tRPC caller via `createCallerFactory` + `makeCaller`.
 *  - Each test configures mock return values, calls the procedure,
 *    then asserts the arguments passed to Prisma (WHERE clauses, data).
 */

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';
const CONTRACTOR_ID = 'clcontractor000000000001';
const CONTRACTOR_ID_2 = 'clcontractor000000000002';
const BILLING_PROFILE_ID = 'clbp000000000000000001';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, any>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ dataRegion: 'EU' }),
    },
    contractor: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: 'new-contractor-id',
        ...opts.data,
      })),
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => ({
        id: opts.where.id,
        ...opts.data,
      })),
      updateMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(async () => 0),
    },
    contractorBillingProfile: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: BILLING_PROFILE_ID,
        ...opts.data,
      })),
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => ({
        id: opts.where.id,
        ...opts.data,
      })),
    },
    contractorComplianceItem: {
      groupBy: vi.fn(async () => []),
    },
    invoice: {
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
    },
    workflowRun: {
      count: vi.fn(async () => 0),
    },
    member: {
      findFirst: vi.fn(async () => ({ role: 'admin' })),
    },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma };
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

vi.mock('../../services/stripe-client.js', () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    invoices: { retrieveUpcoming: vi.fn() },
  },
}));

vi.mock('../../services/billing-service.js', () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
}));

vi.mock('../../services/bank-account-crypto.js', () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('../../services/sanitize.js', () => ({
  sanitizeStrings: vi.fn(<T>(v: T) => v),
}));

vi.mock('../../services/notification-service.js', () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/cache.js', () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {
    approvalChains: (orgId: string) => `approval-chains:${orgId}`,
    dashboardPrefix: (orgId: string) => `dash:${orgId}`,
  },
  CacheTTL: { APPROVAL_CHAINS: 300 },
}));

vi.mock('../../services/calendar-event-service.js', () => ({
  deleteCalendarEvent: vi.fn(async () => undefined),
}));

vi.mock('../../services/calendar-deadline-sync.js', () => ({
  syncContractExpiryDeadline: vi.fn(async () => undefined),
  syncPaymentDueDeadline: vi.fn(async () => undefined),
  syncApprovalSlaDeadline: vi.fn(async () => undefined),
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

vi.mock('../../services/invoice-matching.js', () => ({
  computeDuplicateCheckHash: vi.fn(() => 'hash'),
  runAutoMatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/approval-engine.js', () => ({
  routeToChain: vi.fn(async () => null),
  createApprovalFlow: vi.fn(async () => ({})),
  advanceFlow: vi.fn(async () => undefined),
  computeSlaStatus: vi.fn(() => 'ON_TIME'),
}));

vi.mock('../../services/mime-validator.js', () => ({
  isAllowedMimeType: vi.fn(() => true),
  validateMimeType: vi.fn(async () => ({ valid: true })),
}));

vi.mock('../../services/virus-scanner.js', () => ({
  isClamAvailable: vi.fn(async () => false),
  scanBuffer: vi.fn(async () => ({ clean: true })),
}));

vi.mock('../../services/report-export.js', () => ({
  generateAuditCsv: vi.fn(async () => ({ base64: 'bW9jaw==', filename: 'audit-log.csv' })),
}));

vi.mock('../../services/credit-service.js', () => ({
  deductCredits: vi.fn(async () => undefined),
  getBalance: vi.fn(async () => ({ credits: 0 })),
  hasCredits: vi.fn(async () => true),
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
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Phase 57 · Plan 04 — gov-api + tax-id orchestrator mocks
// ---------------------------------------------------------------------------

const { mockHmrcClient, mockViesClient, validateTaxIdMock } = vi.hoisted(() => ({
  mockHmrcClient: { checkVatNumber: vi.fn() },
  mockViesClient: { checkVatNumber: vi.fn() },
  validateTaxIdMock: vi.fn(async () => ({
    responseStatus: 'valid' as const,
    confirmationRef: null,
    source: 'api' as const,
    requestedAt: new Date('2026-04-13T10:00:00Z'),
    taxIdValidationId: 'clval00000000000000000001',
  })),
}));

vi.mock('../../gov-api-clients.js', () => ({
  getHmrcVatClient: vi.fn(() => mockHmrcClient),
  getViesClient: vi.fn(() => mockViesClient),
}));

vi.mock('../../services/tax-id-validation.service.js', () => ({
  validateTaxId: validateTaxIdMock,
  isValidationFresh: vi.fn(() => false),
  NINETY_DAYS_MS: 90 * 24 * 60 * 60 * 1000,
  getLatestValidation: vi.fn(async () => null),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';
import { encryptBankAccount } from '../../services/bank-account-crypto.js';

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
// Helpers
// ---------------------------------------------------------------------------

function makeContractor(overrides: Record<string, unknown> = {}) {
  return {
    id: CONTRACTOR_ID,
    organizationId: ORG_ID,
    legalName: 'Acme Sp. z o.o.',
    displayName: 'Acme',
    type: 'COMPANY',
    taxId: '1234567890',
    vatId: null,
    registrationNumber: null,
    email: 'acme@example.com',
    phone: null,
    countryCode: 'PL',
    currency: 'PLN',
    addressLine1: 'ul. Testowa 1',
    addressLine2: null,
    city: 'Warszawa',
    postalCode: '00-001',
    status: 'ACTIVE',
    lifecycleStage: 'ACTIVE',
    ownerUserId: null,
    primaryTeamId: null,
    primaryProjectId: null,
    defaultCostCenterId: null,
    customFieldsJson: {},
    deletedAt: null,
    archivedAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-06-01'),
    owner: null,
    primaryTeam: null,
    billingProfiles: [],
    complianceItems: [],
    contracts: [],
    _count: { complianceItems: 0, workflowRuns: 0, invoices: 0 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockPrisma),
  );
});

// ===========================================================================
// Tests
// ===========================================================================

describe('contractor router', () => {
  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('WHERE includes organizationId and deletedAt:null', async () => {
      mockPrisma.contractor.findMany.mockResolvedValueOnce([]);
      mockPrisma.contractor.count.mockResolvedValueOnce(0);

      await caller.contractor.list({
        page: 1,
        pageSize: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      const call = mockPrisma.contractor.findMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        organizationId: ORG_ID,
        deletedAt: null,
      });
    });

    it('calculates skip/take from page and pageSize', async () => {
      mockPrisma.contractor.findMany.mockResolvedValueOnce([]);
      mockPrisma.contractor.count.mockResolvedValueOnce(0);

      await caller.contractor.list({
        page: 3,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      const call = mockPrisma.contractor.findMany.mock.calls[0]?.[0];
      expect(call.skip).toBe(20);
      expect(call.take).toBe(10);
    });

    it('adds search term IDs to where when search is provided', async () => {
      const matchingIds = [{ id: CONTRACTOR_ID }];
      mockPrisma.$queryRaw.mockResolvedValueOnce(matchingIds);
      mockPrisma.contractor.findMany.mockResolvedValueOnce([]);
      mockPrisma.contractor.count.mockResolvedValueOnce(0);

      await caller.contractor.list({
        page: 1,
        pageSize: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'acme',
      });

      const call = mockPrisma.contractor.findMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        id: { in: [CONTRACTOR_ID] },
      });
    });

    it('applies sort order from input', async () => {
      mockPrisma.contractor.findMany.mockResolvedValueOnce([]);
      mockPrisma.contractor.count.mockResolvedValueOnce(0);

      await caller.contractor.list({
        page: 1,
        pageSize: 25,
        sortBy: 'legalName',
        sortOrder: 'asc',
      });

      const call = mockPrisma.contractor.findMany.mock.calls[0]?.[0];
      expect(call.orderBy).toEqual({ legalName: 'asc' });
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  describe('getById', () => {
    it('returns contractor with related data when found', async () => {
      const contractor = makeContractor();
      mockPrisma.contractor.findFirst.mockResolvedValueOnce(contractor);

      const result = await caller.contractor.getById({ id: CONTRACTOR_ID });

      expect(result).toMatchObject({ id: CONTRACTOR_ID, legalName: 'Acme Sp. z o.o.' });
      expect(result).toHaveProperty('complianceHealth');

      const call = mockPrisma.contractor.findFirst.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        id: CONTRACTOR_ID,
        organizationId: ORG_ID,
        deletedAt: null,
      });
    });

    it('throws NOT_FOUND when contractor not found or wrong org', async () => {
      mockPrisma.contractor.findFirst.mockResolvedValueOnce(null);

      await expect(caller.contractor.getById({ id: 'nonexistent' })).rejects.toThrow(TRPCError);

      await expect(caller.contractor.getById({ id: 'nonexistent' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    // NIP 5260250995 passes mod-11 checksum validation
    const createInput = {
      legalName: 'New Corp Sp. z o.o.',
      displayName: 'New Corp',
      type: 'COMPANY' as const,
      taxId: '5260250995',
      email: 'new@example.com',
      countryCode: 'PL',
      currency: 'PLN',
      billingModel: 'TIME_AND_MATERIALS',
      rateValueMinor: 50000,
      ownerUserId: USER_ID,
      bankAccount: '',
    };

    it('passes organizationId and all input fields to prisma.contractor.create', async () => {
      mockPrisma.contractor.create.mockResolvedValueOnce(
        makeContractor({ id: 'new-contractor-id', legalName: 'New Corp Sp. z o.o.' }),
      );
      mockPrisma.contractorBillingProfile.create.mockResolvedValueOnce({
        id: BILLING_PROFILE_ID,
      });

      await caller.contractor.create(createInput);

      const call = mockPrisma.contractor.create.mock.calls[0]?.[0];
      expect(call.data).toMatchObject({
        organizationId: ORG_ID,
        legalName: 'New Corp Sp. z o.o.',
        displayName: 'New Corp',
        type: 'COMPANY',
        taxId: '5260250995',
        email: 'new@example.com',
        countryCode: 'PL',
        currency: 'PLN',
        status: 'ACTIVE',
        lifecycleStage: 'DRAFT',
      });
    });

    it('encrypts bank account via encryptBankAccount', async () => {
      mockPrisma.contractor.create.mockResolvedValueOnce(
        makeContractor({ id: 'new-contractor-id' }),
      );
      mockPrisma.contractorBillingProfile.create.mockResolvedValueOnce({
        id: BILLING_PROFILE_ID,
      });

      // PL61109010140000071219812874 is a valid Polish IBAN
      await caller.contractor.create({
        ...createInput,
        bankAccount: 'PL61109010140000071219812874',
      });

      expect(encryptBankAccount).toHaveBeenCalledWith('PL61109010140000071219812874');

      const profileCall = mockPrisma.contractorBillingProfile.create.mock.calls[0]?.[0];
      expect(profileCall.data).toMatchObject({
        bankAccountEncrypted: 'encrypted:PL61109010140000071219812874',
      });
    });

    it('creates billing profile in the same transaction', async () => {
      mockPrisma.contractor.create.mockResolvedValueOnce(
        makeContractor({ id: 'new-contractor-id' }),
      );
      mockPrisma.contractorBillingProfile.create.mockResolvedValueOnce({
        id: BILLING_PROFILE_ID,
      });

      await caller.contractor.create(createInput);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.contractorBillingProfile.create).toHaveBeenCalled();

      const profileCall = mockPrisma.contractorBillingProfile.create.mock.calls[0]?.[0];
      expect(profileCall.data).toMatchObject({
        organizationId: ORG_ID,
        legalEntityName: 'New Corp Sp. z o.o.',
        preferredCurrency: 'PLN',
        isDefault: true,
      });
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('verifies where clause includes both id and organizationId', async () => {
      const existing = makeContractor();
      mockPrisma.contractor.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.contractor.update.mockResolvedValueOnce(
        makeContractor({ displayName: 'Updated Name' }),
      );

      await caller.contractor.update({
        id: CONTRACTOR_ID,
        displayName: 'Updated Name',
      });

      // Check the findFirst (ownership check) includes org scope
      const findCall = mockPrisma.contractor.findFirst.mock.calls[0]?.[0];
      expect(findCall.where).toMatchObject({
        id: CONTRACTOR_ID,
        organizationId: ORG_ID,
        deletedAt: null,
      });
    });

    it('throws NOT_FOUND for non-existent contractor', async () => {
      mockPrisma.contractor.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.contractor.update({ id: 'nonexistent', displayName: 'X' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  // -------------------------------------------------------------------------
  // updateLifecycleStage
  // -------------------------------------------------------------------------
  describe('updateLifecycleStage', () => {
    it('rejects invalid stage transitions', async () => {
      // ACTIVE -> DRAFT is not a valid transition
      const existing = makeContractor({ lifecycleStage: 'ACTIVE' });
      mockPrisma.contractor.findFirst.mockResolvedValueOnce(existing);

      await expect(
        caller.contractor.updateLifecycleStage({
          id: CONTRACTOR_ID,
          stage: 'DRAFT',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('updates lifecycleStage for valid transitions', async () => {
      const existing = makeContractor({ lifecycleStage: 'ACTIVE' });
      mockPrisma.contractor.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.contractor.update.mockResolvedValueOnce(
        makeContractor({ lifecycleStage: 'OFFBOARDING' }),
      );

      await caller.contractor.updateLifecycleStage({
        id: CONTRACTOR_ID,
        stage: 'OFFBOARDING',
      });

      const updateCall = mockPrisma.contractor.update.mock.calls[0]?.[0];
      expect(updateCall.data).toMatchObject({
        lifecycleStage: 'OFFBOARDING',
      });
    });

    it('sets status to INACTIVE when transitioning to ENDED', async () => {
      const existing = makeContractor({ lifecycleStage: 'OFFBOARDING' });
      mockPrisma.contractor.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.contractor.update.mockResolvedValueOnce(
        makeContractor({ lifecycleStage: 'ENDED', status: 'INACTIVE' }),
      );

      await caller.contractor.updateLifecycleStage({
        id: CONTRACTOR_ID,
        stage: 'ENDED',
      });

      const updateCall = mockPrisma.contractor.update.mock.calls[0]?.[0];
      expect(updateCall.data).toMatchObject({
        lifecycleStage: 'ENDED',
        status: 'INACTIVE',
      });
    });
  });

  // -------------------------------------------------------------------------
  // archive
  // -------------------------------------------------------------------------
  describe('archive', () => {
    it('sets status ARCHIVED and lifecycleStage ENDED', async () => {
      const existing = makeContractor();
      mockPrisma.contractor.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.invoice.count.mockResolvedValueOnce(0);
      mockPrisma.workflowRun.count.mockResolvedValueOnce(0);
      mockPrisma.contractor.update.mockResolvedValueOnce(
        makeContractor({ status: 'ARCHIVED', lifecycleStage: 'ENDED' }),
      );

      await caller.contractor.archive({ id: CONTRACTOR_ID });

      const updateCall = mockPrisma.contractor.update.mock.calls[0]?.[0];
      expect(updateCall.data).toMatchObject({
        status: 'ARCHIVED',
        lifecycleStage: 'ENDED',
      });
      expect(updateCall.data).toHaveProperty('archivedAt');
    });

    it('throws PRECONDITION_FAILED if contractor has unpaid invoices', async () => {
      const existing = makeContractor();
      mockPrisma.contractor.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.invoice.count.mockResolvedValueOnce(3); // 3 unpaid invoices

      await expect(caller.contractor.archive({ id: CONTRACTOR_ID })).rejects.toMatchObject({
        code: 'PRECONDITION_FAILED',
      });
    });
  });

  // -------------------------------------------------------------------------
  // bulkArchive / bulkAssignOwner
  // -------------------------------------------------------------------------
  describe('bulkArchive', () => {
    it('calls updateMany with correct ids and organizationId', async () => {
      mockPrisma.invoice.groupBy.mockResolvedValueOnce([]); // no unpaid invoices
      mockPrisma.contractor.updateMany.mockResolvedValueOnce({ count: 2 });

      await caller.contractor.bulkArchive({
        ids: [CONTRACTOR_ID, CONTRACTOR_ID_2],
      });

      const call = mockPrisma.contractor.updateMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        id: { in: [CONTRACTOR_ID, CONTRACTOR_ID_2] },
        organizationId: ORG_ID,
        deletedAt: null,
      });
      expect(call.data).toMatchObject({
        status: 'ARCHIVED',
        lifecycleStage: 'ENDED',
      });
    });
  });

  describe('bulkAssignOwner', () => {
    it('calls updateMany with correct ids, org, and ownerUserId', async () => {
      mockPrisma.contractor.updateMany.mockResolvedValueOnce({ count: 2 });

      await caller.contractor.bulkAssignOwner({
        ids: [CONTRACTOR_ID, CONTRACTOR_ID_2],
        ownerUserId: USER_ID,
      });

      const call = mockPrisma.contractor.updateMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        id: { in: [CONTRACTOR_ID, CONTRACTOR_ID_2] },
        organizationId: ORG_ID,
        deletedAt: null,
      });
      expect(call.data).toEqual({ ownerUserId: USER_ID });
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 57 — RED scaffolds: contractor.validateVat / revalidateVat (PAY-03, PAY-05)
// Implemented in Plan 57-03.
// ---------------------------------------------------------------------------

describe('contractor.validateVat / revalidateVat (Phase 57 · Plan 04)', () => {
  beforeEach(() => {
    validateTaxIdMock.mockClear();
    validateTaxIdMock.mockResolvedValue({
      responseStatus: 'valid',
      confirmationRef: 'ref-123',
      source: 'api',
      requestedAt: new Date('2026-04-13T10:00:00Z'),
      taxIdValidationId: 'clval00000000000000000001',
    });
  });

  it('validateVat dispatches GB_VAT for a UK contractor and returns the orchestrator result', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValueOnce({
      id: CONTRACTOR_ID,
      countryCode: 'GB',
      vatId: 'GB193054661',
    });

    const result = await caller.contractor.validateVat({ contractorId: CONTRACTOR_ID });

    expect(validateTaxIdMock).toHaveBeenCalledTimes(1);
    expect(validateTaxIdMock.mock.calls[0]?.[0]).toMatchObject({
      organizationId: ORG_ID,
      contractorId: CONTRACTOR_ID,
      taxIdType: 'GB_VAT',
      taxIdValue: 'GB193054661',
    });
    expect(result).toMatchObject({
      responseStatus: 'valid',
      confirmationRef: 'ref-123',
      source: 'api',
    });
  });

  it('validateVat dispatches DE_USTIDNR for a DE contractor', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValueOnce({
      id: CONTRACTOR_ID,
      countryCode: 'DE',
      vatId: 'DE123456789',
    });

    await caller.contractor.validateVat({ contractorId: CONTRACTOR_ID });

    expect(validateTaxIdMock.mock.calls[0]?.[0]).toMatchObject({
      taxIdType: 'DE_USTIDNR',
    });
  });

  it('validateVat throws BAD_REQUEST for a non-GB/DE contractor', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValueOnce({
      id: CONTRACTOR_ID,
      countryCode: 'PL',
      vatId: '1234567890',
    });

    await expect(
      caller.contractor.validateVat({ contractorId: CONTRACTOR_ID }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(validateTaxIdMock).not.toHaveBeenCalled();
  });

  it('validateVat throws NOT_FOUND for a contractor in another organization', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValueOnce(null);

    await expect(
      caller.contractor.validateVat({ contractorId: CONTRACTOR_ID }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(validateTaxIdMock).not.toHaveBeenCalled();
  });

  it('validateVat throws BAD_REQUEST when contractor has no VAT ID', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValueOnce({
      id: CONTRACTOR_ID,
      countryCode: 'GB',
      vatId: null,
    });

    await expect(
      caller.contractor.validateVat({ contractorId: CONTRACTOR_ID }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('revalidateVat routes to validateTaxId with the same payload as validateVat', async () => {
    mockPrisma.contractor.findFirst.mockResolvedValueOnce({
      id: CONTRACTOR_ID,
      countryCode: 'GB',
      vatId: 'GB193054661',
    });

    await caller.contractor.revalidateVat({ contractorId: CONTRACTOR_ID });

    expect(validateTaxIdMock).toHaveBeenCalledTimes(1);
    expect(validateTaxIdMock.mock.calls[0]?.[0]).toMatchObject({
      organizationId: ORG_ID,
      contractorId: CONTRACTOR_ID,
      taxIdType: 'GB_VAT',
    });
  });

  it('revalidateVat returns stale responseStatus when orchestrator soft-fails (D-08)', async () => {
    validateTaxIdMock.mockResolvedValueOnce({
      responseStatus: 'stale',
      confirmationRef: 'prior-ref',
      source: 'stale-cache',
      requestedAt: new Date('2026-04-13T10:00:00Z'),
      taxIdValidationId: 'clval00000000000000000002',
    });
    mockPrisma.contractor.findFirst.mockResolvedValueOnce({
      id: CONTRACTOR_ID,
      countryCode: 'GB',
      vatId: 'GB193054661',
    });

    const result = await caller.contractor.revalidateVat({ contractorId: CONTRACTOR_ID });

    expect(result.responseStatus).toBe('stale');
    expect(result.source).toBe('stale-cache');
  });
});

// ---------------------------------------------------------------------------
// Phase 57 · Plan 04 — D-07 trigger 1: contractor.update VAT-number-change
// ---------------------------------------------------------------------------

describe('contractor.update — D-07 trigger 1 (VAT-number-change validation)', () => {
  beforeEach(() => {
    validateTaxIdMock.mockClear();
    validateTaxIdMock.mockResolvedValue({
      responseStatus: 'valid',
      confirmationRef: 'ref-abc',
      source: 'api',
      requestedAt: new Date('2026-04-13T10:00:00Z'),
      taxIdValidationId: 'clval00000000000000000010',
    });
  });

  it('dispatches validateTaxId exactly once when a UK contractor VAT number changes', async () => {
    const prior = makeContractor({ countryCode: 'GB', vatId: 'GB111111111' });
    mockPrisma.contractor.findFirst.mockResolvedValueOnce(prior);
    mockPrisma.contractor.update.mockResolvedValueOnce(
      makeContractor({ ...prior, vatId: 'GB193054661' }),
    );

    await caller.contractor.update({
      id: CONTRACTOR_ID,
      vatId: 'GB193054661',
    });

    expect(validateTaxIdMock).toHaveBeenCalledTimes(1);
    expect(validateTaxIdMock.mock.calls[0]?.[0]).toMatchObject({
      organizationId: ORG_ID,
      contractorId: CONTRACTOR_ID,
      taxIdType: 'GB_VAT',
      taxIdValue: 'GB193054661',
    });
  });

  it('does NOT dispatch validateTaxId when the VAT number is unchanged (scope guard)', async () => {
    const prior = makeContractor({ countryCode: 'DE', vatId: 'DE123456789' });
    mockPrisma.contractor.findFirst.mockResolvedValueOnce(prior);
    mockPrisma.contractor.update.mockResolvedValueOnce(
      makeContractor({ ...prior, phone: '+49 30 123456' }),
    );

    await caller.contractor.update({
      id: CONTRACTOR_ID,
      phone: '+49 30 123456',
    });

    expect(validateTaxIdMock).not.toHaveBeenCalled();
  });

  it('clears summary fields without API call when VAT number is cleared', async () => {
    const prior = makeContractor({ countryCode: 'GB', vatId: 'GB193054661' });
    mockPrisma.contractor.findFirst.mockResolvedValueOnce(prior);
    mockPrisma.contractor.update
      .mockResolvedValueOnce(makeContractor({ ...prior, vatId: null }))
      .mockResolvedValueOnce(
        makeContractor({
          ...prior,
          vatId: null,
          latestVatValidatedAt: null,
          latestVatValidationStatus: null,
        }),
      );

    await caller.contractor.update({
      id: CONTRACTOR_ID,
      vatId: null,
    });

    expect(validateTaxIdMock).not.toHaveBeenCalled();
    const calls = mockPrisma.contractor.update.mock.calls as [{ data: Record<string, unknown> }][];
    const summaryClearCall = calls.find(
      ([opts]) => 'latestVatValidatedAt' in opts.data && opts.data.latestVatValidatedAt === null,
    );
    expect(summaryClearCall).toBeDefined();
  });
});

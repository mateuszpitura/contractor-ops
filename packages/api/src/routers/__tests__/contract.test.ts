/**
 * Contract router unit tests.
 *
 * Strategy:
 *  - Mock `@contractor-ops/db` with a vi.hoisted mockPrisma.
 *  - Mock `@contractor-ops/auth`, service modules, logger, Sentry.
 *  - Create a tRPC caller via `createCallerFactory` + `makeCaller`.
 *  - Each test configures mock return values, calls the procedure,
 *    then asserts the arguments passed to Prisma (WHERE clauses, data).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';
const CONTRACTOR_ID = 'clcontractor000000000001';
const CONTRACT_ID = 'clcontract0000000000000001';
const ContractId2 = 'clcontract0000000000000002';
const AMENDMENT_ID = 'clamendment000000000000001';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ dataRegion: 'EU' }),
    },
    contract: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: 'new-contract-id',
        ...opts.data,
        contractor: { id: CONTRACTOR_ID, legalName: 'Acme', displayName: 'Acme', status: 'ACTIVE' },
      })),
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => ({
        id: opts.where.id,
        ...opts.data,
      })),
      updateMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(async () => 0),
    },
    contractor: {
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
    },
    contractAmendment: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: AMENDMENT_ID,
        ...opts.data,
      })),
      count: vi.fn(async () => 0),
    },
    documentLink: {
      count: vi.fn(async () => 0),
    },
    auditLog: {
      create: vi.fn(async (opts: { data: Rec }) => ({ id: 'aud_mock', ...opts.data })),
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
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';
import { syncContractExpiryDeadline } from '../../services/calendar-deadline-sync.js';
import { deleteCalendarEvent } from '../../services/calendar-event-service.js';

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

function makeContract(overrides: Record<string, unknown> = {}) {
  return {
    id: CONTRACT_ID,
    organizationId: ORG_ID,
    contractorId: CONTRACTOR_ID,
    title: 'Service Agreement 2025',
    type: 'B2B_MASTER_SERVICE',
    status: 'DRAFT',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    noticePeriodDays: 30,
    autoRenewal: false,
    renewalTerms: null,
    currency: 'PLN',
    billingModel: 'HOURLY',
    rateType: 'PER_HOUR',
    rateValueMinor: 50000,
    retainerAmountMinor: null,
    expectedHoursPerPeriod: null,
    paymentTermsDays: 14,
    invoiceCycle: null,
    internalOwnerUserId: null,
    teamId: null,
    projectId: null,
    costCenterId: null,
    notes: null,
    terminatedAt: null,
    metadataJson: null,
    deletedAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-06-01'),
    contractor: { id: CONTRACTOR_ID, legalName: 'Acme', displayName: 'Acme', status: 'ACTIVE' },
    amendments: [],
    internalOwner: null,
    _count: { invoices: 0 },
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

describe('contract router', () => {
  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    const createInput = {
      contractorId: CONTRACTOR_ID,
      title: 'New Service Agreement',
      type: 'B2B_MASTER_SERVICE' as const,
      startDate: '2025-01-01T00:00:00.000Z',
      endDate: '2025-12-31T00:00:00.000Z',
      autoRenewal: false,
      currency: 'PLN',
      billingModel: 'HOURLY' as const,
      rateType: 'PER_HOUR' as const,
      rateValueMinor: 50000,
    };

    it('passes organizationId and all input fields to prisma.contract.create', async () => {
      mockPrisma.contract.create.mockResolvedValueOnce(makeContract());

      await caller.contract.create(createInput);

      const call = mockPrisma.contract.create.mock.calls[0]?.[0];
      expect(call.data).toMatchObject({
        organizationId: ORG_ID,
        contractorId: CONTRACTOR_ID,
        title: 'New Service Agreement',
        type: 'B2B_MASTER_SERVICE',
        currency: 'PLN',
        billingModel: 'HOURLY',
        rateType: 'PER_HOUR',
        rateValueMinor: 50000,
        status: 'DRAFT',
      });
      expect(call.data.startDate).toBeInstanceOf(Date);
      expect(call.data.endDate).toBeInstanceOf(Date);
    });

    it('includes contractor in the create response', async () => {
      mockPrisma.contract.create.mockResolvedValueOnce(makeContract());

      const result = await caller.contract.create(createInput);

      const call = mockPrisma.contract.create.mock.calls[0]?.[0];
      expect(call.include).toMatchObject({
        contractor: expect.objectContaining({ select: expect.any(Object) }),
      });
      expect(result).toHaveProperty('contractor');
    });

    it('calls syncContractExpiryDeadline when endDate is provided', async () => {
      mockPrisma.contract.create.mockResolvedValueOnce(makeContract());

      await caller.contract.create(createInput);

      // Give fire-and-forget promise a tick to resolve
      await new Promise(r => setTimeout(r, 10));

      expect(syncContractExpiryDeadline).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  describe('getById', () => {
    it('returns contract scoped to organization', async () => {
      const contract = makeContract();
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);
      mockPrisma.documentLink.count.mockResolvedValueOnce(2);

      const result = await caller.contract.getById({ id: CONTRACT_ID });

      expect(result).toMatchObject({ id: CONTRACT_ID, title: 'Service Agreement 2025' });
      expect(result).toHaveProperty('documentCount', 2);

      const call = mockPrisma.contract.findFirst.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        id: CONTRACT_ID,
        organizationId: ORG_ID,
        deletedAt: null,
      });
    });

    it('throws NOT_FOUND for wrong org or nonexistent contract', async () => {
      mockPrisma.contract.findFirst.mockResolvedValueOnce(null);

      await expect(caller.contract.getById({ id: 'nonexistent' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('WHERE includes organizationId and deletedAt:null', async () => {
      mockPrisma.contract.findMany.mockResolvedValueOnce([]);
      mockPrisma.contract.count.mockResolvedValueOnce(0);

      await caller.contract.list({
        page: 1,
        pageSize: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      const call = mockPrisma.contract.findMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        organizationId: ORG_ID,
        deletedAt: null,
      });
    });

    it('applies contractorId filter when provided', async () => {
      mockPrisma.contract.findMany.mockResolvedValueOnce([]);
      mockPrisma.contract.count.mockResolvedValueOnce(0);

      await caller.contract.list({
        page: 1,
        pageSize: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        contractorId: CONTRACTOR_ID,
      });

      const call = mockPrisma.contract.findMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        contractorId: CONTRACTOR_ID,
      });
    });

    it('applies FTS search via $queryRaw when search term provided', async () => {
      const matchingIds = [{ id: CONTRACT_ID }];
      mockPrisma.$queryRaw.mockResolvedValueOnce(matchingIds);
      mockPrisma.contract.findMany.mockResolvedValueOnce([]);
      mockPrisma.contract.count.mockResolvedValueOnce(0);

      await caller.contract.list({
        page: 1,
        pageSize: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'service',
      });

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();

      const call = mockPrisma.contract.findMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        id: { in: [CONTRACT_ID] },
      });
    });
  });

  // -------------------------------------------------------------------------
  // transitionStatus
  // -------------------------------------------------------------------------
  describe('transitionStatus', () => {
    it('allows valid transitions (DRAFT -> ACTIVE)', async () => {
      const contract = makeContract({ status: 'DRAFT' });
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);
      mockPrisma.contract.update.mockResolvedValueOnce(makeContract({ status: 'ACTIVE' }));

      const result = await caller.contract.transitionStatus({
        id: CONTRACT_ID,
        targetStatus: 'ACTIVE',
      });

      const updateCall = mockPrisma.contract.update.mock.calls[0]?.[0];
      expect(updateCall.data).toMatchObject({ status: 'ACTIVE' });
      expect(result).toMatchObject({ status: 'ACTIVE' });
    });

    it('rejects invalid transitions (TERMINATED -> ACTIVE)', async () => {
      const contract = makeContract({ status: 'TERMINATED' });
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);

      await expect(
        caller.contract.transitionStatus({
          id: CONTRACT_ID,
          targetStatus: 'ACTIVE',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('sets terminatedAt when transitioning to TERMINATED', async () => {
      const contract = makeContract({ status: 'ACTIVE' });
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);
      mockPrisma.contract.update.mockResolvedValueOnce(makeContract({ status: 'TERMINATED' }));

      await caller.contract.transitionStatus({
        id: CONTRACT_ID,
        targetStatus: 'TERMINATED',
      });

      const updateCall = mockPrisma.contract.update.mock.calls[0]?.[0];
      expect(updateCall.data).toMatchObject({ status: 'TERMINATED' });
      expect(updateCall.data).toHaveProperty('terminatedAt');
      expect(updateCall.data.terminatedAt).toBeInstanceOf(Date);
    });

    it('rejects invalid transition ACTIVE -> DRAFT', async () => {
      const contract = makeContract({ status: 'ACTIVE' });
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);

      await expect(
        caller.contract.transitionStatus({
          id: CONTRACT_ID,
          targetStatus: 'DRAFT',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('rejects invalid transition EXPIRED -> ACTIVE', async () => {
      const contract = makeContract({ status: 'EXPIRED' });
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);

      await expect(
        caller.contract.transitionStatus({
          id: CONTRACT_ID,
          targetStatus: 'ACTIVE',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  // -------------------------------------------------------------------------
  // update – date validation
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('rejects when endDate equals startDate', async () => {
      const contract = makeContract();
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);

      await expect(
        caller.contract.update({
          id: CONTRACT_ID,
          data: {
            startDate: '2025-06-01T00:00:00.000Z',
            endDate: '2025-06-01T00:00:00.000Z',
          },
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  // -------------------------------------------------------------------------
  // createAmendment
  // -------------------------------------------------------------------------
  describe('createAmendment', () => {
    const amendmentInput = {
      contractId: CONTRACT_ID,
      title: 'Rate Increase 2025',
      effectiveDate: '2025-06-01T00:00:00.000Z',
      description: 'Hourly rate increased from 500 to 600 PLN',
      changesSummaryJson: { rateValueMinor: { from: 50000, to: 60000 } },
    };

    it('creates amendment with auto-incrementing number', async () => {
      const contract = makeContract();
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);
      mockPrisma.contractAmendment.count.mockResolvedValueOnce(2);
      mockPrisma.contractAmendment.create.mockResolvedValueOnce({
        id: AMENDMENT_ID,
        amendmentNumber: 'AME-3',
        ...amendmentInput,
      });

      await caller.contract.createAmendment(amendmentInput);

      const call = mockPrisma.contractAmendment.create.mock.calls[0]?.[0];
      expect(call.data).toMatchObject({
        organizationId: ORG_ID,
        contractId: CONTRACT_ID,
        amendmentNumber: 'AME-3',
        title: 'Rate Increase 2025',
      });
      expect(call.data.effectiveDate).toBeInstanceOf(Date);
    });

    it('links amendment to contract via contractId', async () => {
      const contract = makeContract();
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);
      mockPrisma.contractAmendment.count.mockResolvedValueOnce(0);
      mockPrisma.contractAmendment.create.mockResolvedValueOnce({
        id: AMENDMENT_ID,
        amendmentNumber: 'AME-1',
      });

      await caller.contract.createAmendment(amendmentInput);

      const call = mockPrisma.contractAmendment.create.mock.calls[0]?.[0];
      expect(call.data.contractId).toBe(CONTRACT_ID);
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------
  describe('delete', () => {
    it('soft-deletes by setting deletedAt', async () => {
      const contract = makeContract({ status: 'DRAFT' });
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);
      mockPrisma.contract.update.mockResolvedValueOnce({
        ...contract,
        deletedAt: new Date(),
      });

      const result = await caller.contract.delete({ id: CONTRACT_ID });

      expect(result).toEqual({ success: true });

      const updateCall = mockPrisma.contract.update.mock.calls[0]?.[0];
      expect(updateCall.where).toEqual({ id: CONTRACT_ID });
      expect(updateCall.data).toHaveProperty('deletedAt');
      expect(updateCall.data.deletedAt).toBeInstanceOf(Date);
    });

    it('calls deleteCalendarEvent for cleanup', async () => {
      const contract = makeContract({ status: 'DRAFT' });
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);
      mockPrisma.contract.update.mockResolvedValueOnce({
        ...contract,
        deletedAt: new Date(),
      });

      await caller.contract.delete({ id: CONTRACT_ID });

      // Give fire-and-forget promise a tick to resolve
      await new Promise(r => setTimeout(r, 10));

      expect(deleteCalendarEvent).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          organizationId: ORG_ID,
          entityType: 'CONTRACT',
          entityId: CONTRACT_ID,
        }),
      );
    });

    it('throws NOT_FOUND when contract does not exist', async () => {
      mockPrisma.contract.findFirst.mockResolvedValueOnce(null);

      await expect(caller.contract.delete({ id: 'nonexistent' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('throws BAD_REQUEST when contract is not DRAFT', async () => {
      const contract = makeContract({ status: 'ACTIVE' });
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);

      await expect(caller.contract.delete({ id: CONTRACT_ID })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });

      expect(mockPrisma.contract.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // transitionStatus — NOT_FOUND
  // -------------------------------------------------------------------------
  describe('transitionStatus — NOT_FOUND', () => {
    it('throws NOT_FOUND when contract does not exist', async () => {
      mockPrisma.contract.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.contract.transitionStatus({ id: 'nonexistent', targetStatus: 'ACTIVE' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  // -------------------------------------------------------------------------
  // transitionStatus — additional valid transitions
  // -------------------------------------------------------------------------
  describe('transitionStatus — additional transitions', () => {
    it('allows PENDING_SIGNATURE -> ACTIVE', async () => {
      const contract = makeContract({ status: 'PENDING_SIGNATURE' });
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);
      mockPrisma.contract.update.mockResolvedValueOnce(makeContract({ status: 'ACTIVE' }));

      const result = await caller.contract.transitionStatus({
        id: CONTRACT_ID,
        targetStatus: 'ACTIVE',
      });

      expect(result).toMatchObject({ status: 'ACTIVE' });
    });

    it('allows ACTIVE -> EXPIRING', async () => {
      const contract = makeContract({ status: 'ACTIVE' });
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);
      mockPrisma.contract.update.mockResolvedValueOnce(makeContract({ status: 'EXPIRING' }));

      const result = await caller.contract.transitionStatus({
        id: CONTRACT_ID,
        targetStatus: 'EXPIRING',
      });

      expect(result).toMatchObject({ status: 'EXPIRING' });
    });

    it('allows EXPIRING -> EXPIRED', async () => {
      const contract = makeContract({ status: 'EXPIRING' });
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);
      mockPrisma.contract.update.mockResolvedValueOnce(makeContract({ status: 'EXPIRED' }));

      const result = await caller.contract.transitionStatus({
        id: CONTRACT_ID,
        targetStatus: 'EXPIRED',
      });

      expect(result).toMatchObject({ status: 'EXPIRED' });
    });

    it('rejects SUPERSEDED -> ACTIVE (no outbound transitions)', async () => {
      const contract = makeContract({ status: 'SUPERSEDED' });
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);

      await expect(
        caller.contract.transitionStatus({ id: CONTRACT_ID, targetStatus: 'ACTIVE' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  // -------------------------------------------------------------------------
  // createAmendment — NOT_FOUND
  // -------------------------------------------------------------------------
  describe('createAmendment — error paths', () => {
    it('throws NOT_FOUND when contract does not exist', async () => {
      mockPrisma.contract.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.contract.createAmendment({
          contractId: 'nonexistent',
          title: 'Test Amendment',
          effectiveDate: '2025-06-01T00:00:00.000Z',
          changesSummaryJson: {},
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  // -------------------------------------------------------------------------
  // listAmendments
  // -------------------------------------------------------------------------
  describe('listAmendments', () => {
    it('returns amendments scoped to org and contract', async () => {
      mockPrisma.contractAmendment.findMany.mockResolvedValueOnce([
        { id: AMENDMENT_ID, amendmentNumber: 'AME-1', title: 'Rate change' },
      ]);

      const result = await caller.contract.listAmendments({ contractId: CONTRACT_ID });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: AMENDMENT_ID });

      const call = mockPrisma.contractAmendment.findMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        contractId: CONTRACT_ID,
        organizationId: ORG_ID,
      });
      expect(call.orderBy).toEqual({ effectiveDate: 'desc' });
    });
  });

  // -------------------------------------------------------------------------
  // updateExpiryReminders
  // -------------------------------------------------------------------------
  describe('updateExpiryReminders', () => {
    it('updates metadataJson with reminderDaysBefore', async () => {
      const contract = makeContract({ metadataJson: { someKey: 'value' } });
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);
      mockPrisma.contract.update.mockResolvedValueOnce({
        ...contract,
        metadataJson: { someKey: 'value', reminderDaysBefore: [30, 7] },
      });

      const result = await caller.contract.updateExpiryReminders({
        contractId: CONTRACT_ID,
        reminderDaysBefore: [30, 7],
      });

      const updateCall = mockPrisma.contract.update.mock.calls[0]?.[0];
      expect(updateCall.data.metadataJson).toMatchObject({
        someKey: 'value',
        reminderDaysBefore: [30, 7],
      });
      expect(result).toHaveProperty('metadataJson');
    });

    it('throws NOT_FOUND when contract does not exist', async () => {
      mockPrisma.contract.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.contract.updateExpiryReminders({
          contractId: 'nonexistent',
          reminderDaysBefore: [14],
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  // -------------------------------------------------------------------------
  // update — calendar sync
  // -------------------------------------------------------------------------
  describe('update — calendar sync', () => {
    it('syncs contract expiry deadline when endDate is updated', async () => {
      const contract = makeContract();
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);
      mockPrisma.contract.update.mockResolvedValueOnce({
        ...contract,
        endDate: new Date('2026-12-31'),
        contractorId: CONTRACTOR_ID,
        title: 'Updated Agreement',
      });
      mockPrisma.contractor.findUnique.mockResolvedValueOnce({
        displayName: 'Acme Corp',
      });

      await caller.contract.update({
        id: CONTRACT_ID,
        data: { endDate: '2026-12-31T00:00:00.000Z' },
      });

      await new Promise(r => setTimeout(r, 10));

      expect(syncContractExpiryDeadline).toHaveBeenCalled();
    });

    it('deletes calendar event when endDate is cleared', async () => {
      const contract = makeContract({ endDate: new Date('2025-12-31') });
      mockPrisma.contract.findFirst.mockResolvedValueOnce(contract);
      mockPrisma.contract.update.mockResolvedValueOnce({
        ...contract,
        endDate: null,
        contractorId: CONTRACTOR_ID,
      });

      await caller.contract.update({
        id: CONTRACT_ID,
        data: { endDate: null },
      });

      await new Promise(r => setTimeout(r, 10));

      expect(deleteCalendarEvent).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          organizationId: ORG_ID,
          entityType: 'CONTRACT',
          entityId: CONTRACT_ID,
        }),
      );
    });

    it('throws NOT_FOUND when contract does not exist', async () => {
      mockPrisma.contract.findFirst.mockResolvedValueOnce(null);

      await expect(
        caller.contract.update({ id: 'nonexistent', data: { title: 'X' } }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  // -------------------------------------------------------------------------
  // bulkTransition
  // -------------------------------------------------------------------------
  describe('bulkTransition', () => {
    it('transitions valid contracts and reports failures', async () => {
      mockPrisma.contract.findMany.mockResolvedValueOnce([
        { id: CONTRACT_ID, status: 'DRAFT' },
        { id: ContractId2, status: 'TERMINATED' },
      ]);
      mockPrisma.contract.updateMany.mockResolvedValueOnce({ count: 1 });

      const result = await caller.contract.bulkTransition({
        ids: [CONTRACT_ID, ContractId2],
        targetStatus: 'ACTIVE',
      });

      expect(result.updated).toBe(1);
      expect(result.failed).toContain(ContractId2);
    });

    it('includes not-found IDs in failed list', async () => {
      mockPrisma.contract.findMany.mockResolvedValueOnce([{ id: CONTRACT_ID, status: 'DRAFT' }]);
      mockPrisma.contract.updateMany.mockResolvedValueOnce({ count: 1 });

      const result = await caller.contract.bulkTransition({
        ids: [CONTRACT_ID, 'nonexistent-id'],
        targetStatus: 'ACTIVE',
      });

      expect(result.updated).toBe(1);
      expect(result.failed).toContain('nonexistent-id');
    });

    it('sets terminatedAt for bulk TERMINATED transitions', async () => {
      mockPrisma.contract.findMany.mockResolvedValueOnce([{ id: CONTRACT_ID, status: 'ACTIVE' }]);
      mockPrisma.contract.updateMany.mockResolvedValueOnce({ count: 1 });

      await caller.contract.bulkTransition({
        ids: [CONTRACT_ID],
        targetStatus: 'TERMINATED',
      });

      const txFn = mockPrisma.$transaction.mock.calls[0]?.[0];
      // The transaction was called, verify updateMany was called
      expect(mockPrisma.contract.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'TERMINATED',
            terminatedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('skips update when no valid contracts found', async () => {
      mockPrisma.contract.findMany.mockResolvedValueOnce([
        { id: CONTRACT_ID, status: 'TERMINATED' },
      ]);

      const result = await caller.contract.bulkTransition({
        ids: [CONTRACT_ID],
        targetStatus: 'ACTIVE',
      });

      expect(result.updated).toBe(0);
      expect(result.failed).toContain(CONTRACT_ID);
      // $transaction is not called for updateMany when no valid IDs
      expect(mockPrisma.contract.updateMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // list — search with no results
  // -------------------------------------------------------------------------
  describe('list — search edge cases', () => {
    it('returns empty results when FTS search finds no matching IDs', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await caller.contract.list({
        page: 1,
        pageSize: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'nonexistent',
      });

      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
      // findMany should NOT be called when queryRaw returns empty
      expect(mockPrisma.contract.findMany).not.toHaveBeenCalled();
    });

    it('applies status and type filters', async () => {
      mockPrisma.contract.findMany.mockResolvedValueOnce([]);
      mockPrisma.contract.count.mockResolvedValueOnce(0);

      await caller.contract.list({
        page: 1,
        pageSize: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        filters: {
          status: ['ACTIVE', 'EXPIRING'],
          type: ['B2B_MASTER_SERVICE'],
        },
      });

      const call = mockPrisma.contract.findMany.mock.calls[0]?.[0];
      expect(call.where.status).toEqual({ in: ['ACTIVE', 'EXPIRING'] });
      expect(call.where.type).toEqual({ in: ['B2B_MASTER_SERVICE'] });
    });

    it('applies endDate range filter', async () => {
      mockPrisma.contract.findMany.mockResolvedValueOnce([]);
      mockPrisma.contract.count.mockResolvedValueOnce(0);

      await caller.contract.list({
        page: 1,
        pageSize: 25,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        filters: {
          endDateFrom: '2025-01-01T00:00:00.000Z',
          endDateTo: '2025-12-31T00:00:00.000Z',
        },
      });

      const call = mockPrisma.contract.findMany.mock.calls[0]?.[0];
      expect(call.where.endDate).toBeDefined();
      expect(call.where.endDate.gte).toBeInstanceOf(Date);
      expect(call.where.endDate.lte).toBeInstanceOf(Date);
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 60 CLASS-08 — AuditLog write-through (resolves Open Question #1).
  // ---------------------------------------------------------------------------

  describe('contract.update writes AuditLog', () => {
    it('emits a CONTRACT/UPDATE audit row capturing changed fields', async () => {
      const before = makeContract({ status: 'DRAFT', rateValueMinor: 10000 });
      mockPrisma.contract.findFirst.mockResolvedValueOnce(before);
      mockPrisma.contract.update.mockResolvedValueOnce({ ...before, rateValueMinor: 12500 });
      mockPrisma.auditLog.create.mockClear();

      await caller.contract.update({
        id: CONTRACT_ID,
        data: { rateValueMinor: 12500 } as never,
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
      const args = mockPrisma.auditLog.create.mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(args.data.resourceType).toBe('CONTRACT');
      expect(args.data.resourceId).toBe(CONTRACT_ID);
      expect(args.data.action).toBe('UPDATE');
      const oldValues = args.data.oldValuesJson as Record<string, unknown>;
      const newValues = args.data.newValuesJson as Record<string, unknown>;
      expect(oldValues.rateValueMinor).toBe(10000);
      expect(newValues.rateValueMinor).toBe(12500);
    });
  });

  describe('contract.create writes AuditLog', () => {
    it('emits a CONTRACT/CREATE audit row', async () => {
      mockPrisma.contract.create.mockResolvedValueOnce({
        ...makeContract(),
        contractor: { id: CONTRACTOR_ID, legalName: 'Acme', displayName: 'Acme', status: 'ACTIVE' },
      });
      mockPrisma.auditLog.create.mockClear();

      await caller.contract.create({
        contractorId: CONTRACTOR_ID,
        title: 'Service Agreement 2025',
        type: 'B2B_MASTER_SERVICE',
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-12-31T00:00:00.000Z',
        currency: 'PLN',
        billingModel: 'MONTHLY_RETAINER',
        rateType: 'MONTHLY_FIXED',
        autoRenewal: false,
        expenseReimbursementAllowed: false,
        requiresTimesheet: false,
        requiresDeliverableAcceptance: false,
      } as never);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
      const args = mockPrisma.auditLog.create.mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(args.data.resourceType).toBe('CONTRACT');
      expect(args.data.action).toBe('CREATE');
      expect(args.data.oldValuesJson).toBeUndefined();
    });
  });
});

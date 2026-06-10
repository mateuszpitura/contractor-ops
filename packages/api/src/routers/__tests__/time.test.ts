/**
 * Time router unit tests.
 *
 * Strategy:
 *  - Mock `@contractor-ops/db` with a vi.hoisted mockPrisma.
 *  - Mock `@contractor-ops/auth`, logger, Sentry, and service modules.
 *  - Create a tRPC caller via `createCallerFactory` + `makeCaller`.
 *  - Each test configures mock return values, calls the procedure,
 *    then asserts the arguments passed to Prisma or service delegates.
 */

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';
const TIMESHEET_ID_1 = 'clts0000000000000000000001';
const TIMESHEET_ID_2 = 'clts0000000000000000000002';
const CONTRACTOR_ID = 'clcontractor000000000001';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    timesheet: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      groupBy: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    contractor: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
    },
    invoice: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => ({
        id: opts.where.id,
        ...opts.data,
      })),
      updateMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(async () => 0),
    },
    member: {
      findFirst: vi.fn(async () => ({ role: 'admin' })),
    },
    auditLog: {
      create: vi.fn(async () => ({})),
    },
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
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
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

const {
  mockApproveTimesheet,
  mockRejectTimesheet,
  mockBulkApproveTimesheets,
  mockBulkRejectTimesheets,
} = vi.hoisted(() => ({
  mockApproveTimesheet: vi.fn(async () => ({ id: 'clts00000000000000000001', status: 'APPROVED' })),
  mockRejectTimesheet: vi.fn(async () => ({ id: 'clts00000000000000000001', status: 'REJECTED' })),
  mockBulkApproveTimesheets: vi.fn(async () => ({ count: 2 })),
  mockBulkRejectTimesheets: vi.fn(async () => ({ count: 2 })),
}));

vi.mock('../../services/time-entry', () => ({
  approveTimesheet: mockApproveTimesheet,
  rejectTimesheet: mockRejectTimesheet,
  bulkApproveTimesheets: mockBulkApproveTimesheets,
  bulkRejectTimesheets: mockBulkRejectTimesheets,
}));

vi.mock('../../services/time-reconciliation', () => ({
  computeTimeReconciliation: vi.fn(async () => null),
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

vi.mock('../../services/notification-service', () => ({
  dispatch: vi.fn(async () => undefined),
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
  generateAuditCsv: vi.fn(async () => ({ base64: 'bW9jaw==', filename: 'audit-log.csv' })),
}));

vi.mock('../../services/billing-service', () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
}));

vi.mock('../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: { approvalChains: (orgId: string) => `approval-chains:${orgId}` },
  CacheTTL: { APPROVAL_CHAINS: 300 },
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

vi.mock('../../services/credit-service', () => ({
  deductCredits: vi.fn(async () => undefined),
  getBalance: vi.fn(async () => ({ credits: 0 })),
  hasCredits: vi.fn(async () => true),
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

vi.mock('../../services/import-processor', () => ({
  parseImportFile: vi.fn(async () => []),
  autoMapColumns: vi.fn(() => ({})),
  processImportFile: vi.fn(async () => ({ valid: [], invalid: [], duplicates: [] })),
}));

vi.mock('../../services/equipment-workflow', () => ({
  checkShipmentTaskCompletion: vi.fn(async () => undefined),
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
  getIdpAuditLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() })),
  withBodyLogging: vi.fn((_o, fn) => fn),
  logIntegrationCall: vi.fn(),
  subscribeOpossumEvents: vi.fn(),
  runWithRequestContext: vi.fn((_c, fn) => fn()),
  getRequestId: vi.fn(() => undefined),
  getTraceparent: vi.fn(() => undefined),
  buildContextFromHeaders: vi.fn(() => ({})),
  getOutboundHeaders: vi.fn(() => ({})),
  generateRequestId: vi.fn(() => 'test-request-id'),
  LOG_BODY_INCLUDE_PREFIXES: [],
  PII_MASK_KEYWORDS: [],
  PII_MASK_PATHS: [],
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(),
 warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
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

import { createCallerFactory } from '../../init';
import { appRouter } from '../../root';

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
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockPrisma),
  );
});

// ===========================================================================
// Time Router Tests
// ===========================================================================

describe('time router', () => {
  // =========================================================================
  // listPending
  // =========================================================================

  describe('listPending', () => {
    it('queries SUBMITTED timesheets for the organization', async () => {
      mockPrisma.timesheet.findMany.mockResolvedValueOnce([]);

      await caller.time.listPending();

      const call = mockPrisma.timesheet.findMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        organizationId: ORG_ID,
        status: 'SUBMITTED',
      });
    });

    it('orders by submittedAt ascending (oldest first)', async () => {
      mockPrisma.timesheet.findMany.mockResolvedValueOnce([]);

      await caller.time.listPending();

      const call = mockPrisma.timesheet.findMany.mock.calls[0]?.[0];
      expect(call.orderBy).toEqual({ submittedAt: 'asc' });
    });

    it('includes contractor info and entry count', async () => {
      mockPrisma.timesheet.findMany.mockResolvedValueOnce([]);

      await caller.time.listPending();

      const call = mockPrisma.timesheet.findMany.mock.calls[0]?.[0];
      expect(call.include.contractor).toBeDefined();
      expect(call.include._count).toEqual({ select: { entries: true } });
    });
  });

  // =========================================================================
  // listAll
  // =========================================================================

  describe('listAll', () => {
    it('queries all timesheets scoped to organization with pagination', async () => {
      mockPrisma.timesheet.findMany.mockResolvedValueOnce([]);

      await caller.time.listAll({ limit: 20 });

      const call = mockPrisma.timesheet.findMany.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        organizationId: ORG_ID,
      });
      expect(call.take).toBe(21); // limit + 1 for cursor
    });

    it('applies status filter when provided', async () => {
      mockPrisma.timesheet.findMany.mockResolvedValueOnce([]);

      await caller.time.listAll({ limit: 20, status: 'APPROVED' });

      const call = mockPrisma.timesheet.findMany.mock.calls[0]?.[0];
      expect(call.where.status).toBe('APPROVED');
    });

    it('applies contractorId filter when provided', async () => {
      mockPrisma.timesheet.findMany.mockResolvedValueOnce([]);

      await caller.time.listAll({ limit: 20, contractorId: CONTRACTOR_ID });

      const call = mockPrisma.timesheet.findMany.mock.calls[0]?.[0];
      expect(call.where.contractorId).toBe(CONTRACTOR_ID);
    });

    it('applies date range filter when from/to provided', async () => {
      mockPrisma.timesheet.findMany.mockResolvedValueOnce([]);

      await caller.time.listAll({
        limit: 20,
        from: '2025-01-01',
        to: '2025-01-31',
      });

      const call = mockPrisma.timesheet.findMany.mock.calls[0]?.[0];
      expect(call.where.weekStartDate).toBeDefined();
      expect(call.where.weekStartDate.gte).toEqual(new Date('2025-01-01'));
      expect(call.where.weekStartDate.lte).toEqual(new Date('2025-01-31'));
    });

    it('returns nextCursor when more items exist', async () => {
      const items = Array.from({ length: 21 }, (_, i) => ({
        id: `ts-${i}`,
        organizationId: ORG_ID,
        contractor: { id: CONTRACTOR_ID, legalName: 'Acme', email: 'a@b.com' },
        _count: { entries: 3 },
      }));
      mockPrisma.timesheet.findMany.mockResolvedValueOnce(items);

      const result = await caller.time.listAll({ limit: 20 });

      expect(result.nextCursor).toBe('ts-20');
      expect(result.items).toHaveLength(20);
    });
  });

  // =========================================================================
  // getTimesheet
  // =========================================================================

  describe('getTimesheet', () => {
    it('queries by timesheetId scoped to organization', async () => {
      mockPrisma.timesheet.findFirst.mockResolvedValueOnce({
        id: TIMESHEET_ID_1,
        organizationId: ORG_ID,
        contractor: { id: CONTRACTOR_ID, legalName: 'Acme', email: 'a@b.com' },
        entries: [],
      });

      await caller.time.getTimesheet({ timesheetId: TIMESHEET_ID_1 });

      const call = mockPrisma.timesheet.findFirst.mock.calls[0]?.[0];
      expect(call.where).toMatchObject({
        id: TIMESHEET_ID_1,
        organizationId: ORG_ID,
      });
    });

    it('includes entries with contract info', async () => {
      mockPrisma.timesheet.findFirst.mockResolvedValueOnce({
        id: TIMESHEET_ID_1,
        organizationId: ORG_ID,
        contractor: { id: CONTRACTOR_ID, legalName: 'Acme', email: 'a@b.com' },
        entries: [],
      });

      await caller.time.getTimesheet({ timesheetId: TIMESHEET_ID_1 });

      const call = mockPrisma.timesheet.findFirst.mock.calls[0]?.[0];
      expect(call.include.entries).toBeDefined();
      expect(call.include.entries.include.contract).toBeDefined();
    });

    it('throws NOT_FOUND when timesheet does not exist', async () => {
      mockPrisma.timesheet.findFirst.mockResolvedValueOnce(null);

      await expect(caller.time.getTimesheet({ timesheetId: 'nonexistent' })).rejects.toThrow(
        TRPCError,
      );
    });
  });

  // =========================================================================
  // approve
  // =========================================================================

  describe('approve', () => {
    it('delegates to approveTimesheet service with org scope', async () => {
      await caller.time.approve({ timesheetId: TIMESHEET_ID_1 });

      expect(mockApproveTimesheet).toHaveBeenCalledWith(
        mockPrisma,
        ORG_ID,
        TIMESHEET_ID_1,
        USER_ID,
      );
    });
  });

  // =========================================================================
  // reject
  // =========================================================================

  describe('reject', () => {
    it('delegates to rejectTimesheet service with reason', async () => {
      await caller.time.reject({
        timesheetId: TIMESHEET_ID_1,
        reason: 'Hours do not match contract',
      });

      expect(mockRejectTimesheet).toHaveBeenCalledWith(
        mockPrisma,
        ORG_ID,
        TIMESHEET_ID_1,
        USER_ID,
        'Hours do not match contract',
      );
    });
  });

  // =========================================================================
  // bulkApprove
  // =========================================================================

  describe('bulkApprove', () => {
    it('delegates to bulkApproveTimesheets service', async () => {
      const ids = [TIMESHEET_ID_1, TIMESHEET_ID_2];

      const result = await caller.time.bulkApprove({ timesheetIds: ids });

      expect(mockBulkApproveTimesheets).toHaveBeenCalledWith(mockPrisma, ORG_ID, ids, USER_ID);
      expect(result).toEqual({ count: 2 });
    });
  });

  // =========================================================================
  // bulkReject
  // =========================================================================

  describe('bulkReject', () => {
    it('delegates to bulkRejectTimesheets service with reason', async () => {
      const ids = [TIMESHEET_ID_1, TIMESHEET_ID_2];

      const result = await caller.time.bulkReject({
        timesheetIds: ids,
        reason: 'Incorrect hours reported',
      });

      expect(mockBulkRejectTimesheets).toHaveBeenCalledWith(
        mockPrisma,
        ORG_ID,
        ids,
        USER_ID,
        'Incorrect hours reported',
      );
      expect(result).toEqual({ count: 2 });
    });
  });

  // =========================================================================
  // approve — additional coverage
  // =========================================================================

  describe('approve (additional)', () => {
    it('returns the approved timesheet result from service', async () => {
      mockApproveTimesheet.mockResolvedValueOnce({
        id: TIMESHEET_ID_1,
        status: 'APPROVED',
        approvedAt: new Date('2026-04-01'),
        approvedBy: USER_ID,
      });

      const result = await caller.time.approve({ timesheetId: TIMESHEET_ID_1 });

      expect(result).toMatchObject({ id: TIMESHEET_ID_1, status: 'APPROVED' });
    });

    it('propagates service errors', async () => {
      mockApproveTimesheet.mockRejectedValueOnce(new Error('Timesheet already approved'));

      await expect(caller.time.approve({ timesheetId: TIMESHEET_ID_1 })).rejects.toThrow(
        'Timesheet already approved',
      );
    });
  });

  // =========================================================================
  // reject — additional coverage
  // =========================================================================

  describe('reject (additional)', () => {
    it('returns the rejected timesheet result from service', async () => {
      mockRejectTimesheet.mockResolvedValueOnce({
        id: TIMESHEET_ID_1,
        status: 'REJECTED',
        rejectionReason: 'Incorrect hours',
      });

      const result = await caller.time.reject({
        timesheetId: TIMESHEET_ID_1,
        reason: 'Incorrect hours',
      });

      expect(result).toMatchObject({ id: TIMESHEET_ID_1, status: 'REJECTED' });
    });

    it('propagates service errors', async () => {
      mockRejectTimesheet.mockRejectedValueOnce(new Error('Timesheet not in SUBMITTED state'));

      await expect(
        caller.time.reject({
          timesheetId: TIMESHEET_ID_1,
          reason: 'Timesheet not in SUBMITTED state - rejecting',
        }),
      ).rejects.toThrow('Timesheet not in SUBMITTED state');
    });
  });

  // =========================================================================
  // bulkApprove — additional coverage
  // =========================================================================

  describe('bulkApprove (additional)', () => {
    it('returns count from service', async () => {
      mockBulkApproveTimesheets.mockResolvedValueOnce({ count: 5 });

      const result = await caller.time.bulkApprove({
        timesheetIds: ['t1', 't2', 't3', 't4', 't5'],
      });

      expect(result).toEqual({ count: 5 });
    });

    it('propagates service errors on bulk approve', async () => {
      mockBulkApproveTimesheets.mockRejectedValueOnce(new Error('Some timesheets invalid'));

      await expect(caller.time.bulkApprove({ timesheetIds: [TIMESHEET_ID_1] })).rejects.toThrow(
        'Some timesheets invalid',
      );
    });
  });

  // =========================================================================
  // bulkReject — additional coverage
  // =========================================================================

  describe('bulkReject (additional)', () => {
    it('propagates service errors on bulk reject', async () => {
      mockBulkRejectTimesheets.mockRejectedValueOnce(new Error('No timesheets found'));

      await expect(
        caller.time.bulkReject({
          timesheetIds: [TIMESHEET_ID_1],
          reason: 'Invalid timesheet entries detected',
        }),
      ).rejects.toThrow('No timesheets found');
    });
  });

  // =========================================================================
  // listContractors
  // =========================================================================

  describe('listContractors', () => {
    it('returns contractors with pending counts and monthly stats', async () => {
      mockPrisma.contractor.findMany.mockResolvedValueOnce([
        { id: CONTRACTOR_ID, legalName: 'Acme', email: 'acme@test.com' },
      ]);
      mockPrisma.timesheet.groupBy
        .mockResolvedValueOnce([{ contractorId: CONTRACTOR_ID, _count: 3 }]) // pending
        .mockResolvedValueOnce([{ contractorId: CONTRACTOR_ID }]) // has timesheets
        .mockResolvedValueOnce([{ contractorId: CONTRACTOR_ID, _sum: { totalMinutes: 4800 } }]); // monthly

      const result = await caller.time.listContractors();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: CONTRACTOR_ID,
        pendingCount: 3,
        approvedMinutesThisMonth: 4800,
      });
    });

    it('filters out contractors without any timesheets', async () => {
      mockPrisma.contractor.findMany.mockResolvedValueOnce([
        { id: CONTRACTOR_ID, legalName: 'Acme', email: 'acme@test.com' },
        { id: 'c-no-ts', legalName: 'NoTS', email: 'nots@test.com' },
      ]);
      mockPrisma.timesheet.groupBy
        .mockResolvedValueOnce([]) // pending
        .mockResolvedValueOnce([{ contractorId: CONTRACTOR_ID }]) // has timesheets — only CONTRACTOR_ID
        .mockResolvedValueOnce([]); // monthly

      const result = await caller.time.listContractors();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(CONTRACTOR_ID);
    });

    it('returns empty when no contractors have timesheets', async () => {
      mockPrisma.contractor.findMany.mockResolvedValueOnce([
        { id: CONTRACTOR_ID, legalName: 'Acme', email: 'acme@test.com' },
      ]);
      mockPrisma.timesheet.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await caller.time.listContractors();

      expect(result).toHaveLength(0);
    });
  });

  // =========================================================================
  // getReconciliation
  // =========================================================================

  describe('getReconciliation', () => {
    it('delegates to computeTimeReconciliation', async () => {
      const { computeTimeReconciliation } = await import('../../services/time-reconciliation');
      vi.mocked(computeTimeReconciliation).mockResolvedValueOnce({
        expectedAmountMinor: 100000,
        approvedMinutes: 4800,
        rateValueMinor: 5000,
        rateType: 'PER_HOUR',
        deviationPercent: 5.2,
        deviationAmountMinor: 5200,
      } as never);

      const result = await caller.time.getReconciliation({
        contractId: 'contract-1',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        invoicedAmountMinor: 105200,
      });

      expect(result).toMatchObject({ deviationPercent: 5.2 });
      expect(computeTimeReconciliation).toHaveBeenCalledWith(
        mockPrisma,
        ORG_ID,
        'contract-1',
        new Date('2026-01-01'),
        new Date('2026-01-31'),
        105200,
      );
    });
  });

  // =========================================================================
  // getInvoiceReconciliation
  // =========================================================================

  describe('getInvoiceReconciliation', () => {
    it('returns null when invoice has no contractId', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce({
        contractId: null,
        totalMinor: 10000,
        issueDate: new Date(),
      });

      const result = await caller.time.getInvoiceReconciliation({
        invoiceId: 'inv-1',
      });

      expect(result).toBeNull();
    });

    it('returns null when invoice not found', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValueOnce(null);

      const result = await caller.time.getInvoiceReconciliation({
        invoiceId: 'nonexistent',
      });

      expect(result).toBeNull();
    });
  });
});

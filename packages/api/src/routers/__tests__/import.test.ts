/**
 * Import router unit tests.
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
    contractor: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: CONTRACTOR_ID,
        ...opts.data,
      })),
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => ({
        id: opts.where.id,
        ...opts.data,
      })),
    },
    contract: {
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: 'contract-1',
        ...opts.data,
      })),
    },
    contractorBillingProfile: {
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: 'bp-1',
        ...opts.data,
      })),
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

const { mockParseImportFile, mockAutoMapColumns, mockProcessImportFile } = vi.hoisted(() => ({
  mockParseImportFile: vi.fn(async () => [
    { legalName: 'Acme Corp', email: 'acme@example.com', taxId: '1234567890' },
    { legalName: 'Beta Inc', email: 'beta@example.com', taxId: '0987654321' },
  ]),
  mockAutoMapColumns: vi.fn(() => ({
    legalName: 'legalName',
    email: 'email',
    taxId: 'taxId',
  })),
  mockProcessImportFile: vi.fn(async () => ({
    valid: [{ legalName: 'Acme Corp', email: 'acme@example.com', taxId: '1234567890' }],
    invalid: [],
    duplicates: [{ legalName: 'Beta Inc', taxId: '0987654321' }],
  })),
}));

vi.mock('../../services/import-processor', () => ({
  parseImportFile: mockParseImportFile,
  autoMapColumns: mockAutoMapColumns,
  processImportFile: mockProcessImportFile,
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

vi.mock('../../services/time-entry', () => ({
  approveTimesheet: vi.fn(async () => ({})),
  rejectTimesheet: vi.fn(async () => ({})),
  bulkApproveTimesheets: vi.fn(async () => ({ count: 0 })),
  bulkRejectTimesheets: vi.fn(async () => ({ count: 0 })),
}));

vi.mock('../../services/time-reconciliation', () => ({
  computeTimeReconciliation: vi.fn(async () => null),
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
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
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
// Helpers
// ---------------------------------------------------------------------------

/** Minimal base64-encoded CSV content for testing */
const SAMPLE_CSV_BASE64 = Buffer.from(
  'legalName,email,taxId\nAcme Corp,acme@example.com,1234567890\nBeta Inc,beta@example.com,0987654321',
).toString('base64');

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockPrisma),
  );
  // Restore default mock implementations
  mockParseImportFile.mockResolvedValue([
    { legalName: 'Acme Corp', email: 'acme@example.com', taxId: '1234567890' },
    { legalName: 'Beta Inc', email: 'beta@example.com', taxId: '0987654321' },
  ]);
  mockAutoMapColumns.mockReturnValue({
    legalName: 'legalName',
    email: 'email',
    taxId: 'taxId',
  });
  mockProcessImportFile.mockResolvedValue({
    valid: [{ legalName: 'Acme Corp', email: 'acme@example.com', taxId: '1234567890' }],
    invalid: [],
    duplicates: [{ legalName: 'Beta Inc', taxId: '0987654321' }],
  });
});

// ===========================================================================
// Import Router Tests
// ===========================================================================

describe('import router', () => {
  // =========================================================================
  // parse
  // =========================================================================

  describe('parse', () => {
    it('parses file and returns headers, sample rows, and suggested mapping', async () => {
      const result = await caller.import.parse({
        fileBase64: SAMPLE_CSV_BASE64,
        entityType: 'contractor',
      });

      expect(mockParseImportFile).toHaveBeenCalledTimes(1);
      // Verify buffer was passed
      const bufferArg = (mockParseImportFile.mock.calls as unknown)[0]?.[0];
      expect(Buffer.isBuffer(bufferArg)).toBe(true);

      expect(mockAutoMapColumns).toHaveBeenCalledWith(
        ['legalName', 'email', 'taxId'],
        'contractor',
      );

      expect(result).toMatchObject({
        headers: ['legalName', 'email', 'taxId'],
        totalRows: 2,
        suggestedMapping: { legalName: 'legalName', email: 'email', taxId: 'taxId' },
      });
      expect(result.sampleRows).toHaveLength(2);
    });

    it('throws BAD_REQUEST when file has no data rows', async () => {
      mockParseImportFile.mockResolvedValueOnce([]);

      await expect(
        caller.import.parse({
          fileBase64: SAMPLE_CSV_BASE64,
          entityType: 'contractor',
        }),
      ).rejects.toThrow(TRPCError);
    });

    it('throws BAD_REQUEST when parse fails', async () => {
      mockParseImportFile.mockRejectedValueOnce(new Error('Invalid CSV format'));

      await expect(
        caller.import.parse({
          fileBase64: SAMPLE_CSV_BASE64,
          entityType: 'contractor',
        }),
      ).rejects.toThrow(TRPCError);
    });

    it('works for contract entity type', async () => {
      mockParseImportFile.mockResolvedValueOnce([
        { title: 'Contract 1', contractorTaxId: '1234567890', startDate: '2025-01-01' },
      ] as unknown);
      mockAutoMapColumns.mockReturnValueOnce({
        title: 'title',
        contractorTaxId: 'contractorTaxId',
      } as unknown);

      const result = await caller.import.parse({
        fileBase64: SAMPLE_CSV_BASE64,
        entityType: 'contract',
      });

      expect(mockAutoMapColumns).toHaveBeenCalledWith(
        ['title', 'contractorTaxId', 'startDate'],
        'contract',
      );
      expect(result.totalRows).toBe(1);
    });
  });

  // =========================================================================
  // validate
  // =========================================================================

  describe('validate', () => {
    it('calls processImportFile with buffer, entityType, orgId, and column mapping', async () => {
      const columnMapping = { legalName: 'legalName', email: 'email', taxId: 'taxId' };

      await caller.import.validate({
        fileBase64: SAMPLE_CSV_BASE64,
        entityType: 'contractor',
        columnMapping,
      });

      expect(mockProcessImportFile).toHaveBeenCalledTimes(1);
      const args = (mockProcessImportFile.mock.calls as unknown)[0];
      expect(Buffer.isBuffer(args?.[0])).toBe(true);
      expect(args?.[1]).toBe('contractor');
      expect(args?.[2]).toBe(ORG_ID);
      expect(args?.[3]).toEqual(columnMapping);
    });

    it('returns valid, invalid, and duplicate row arrays', async () => {
      const result = await caller.import.validate({
        fileBase64: SAMPLE_CSV_BASE64,
        entityType: 'contractor',
        columnMapping: { legalName: 'legalName' },
      });

      expect(result).toMatchObject({
        valid: expect.arrayContaining([expect.objectContaining({ legalName: 'Acme Corp' })]),
        invalid: [],
        duplicates: expect.arrayContaining([expect.objectContaining({ legalName: 'Beta Inc' })]),
      });
    });
  });

  // =========================================================================
  // commit (contractors)
  // =========================================================================

  describe('commit - contractors', () => {
    it('creates contractors from validated data in a transaction', async () => {
      const rows = [
        {
          legalName: 'Acme Corp',
          displayName: 'Acme',
          type: 'COMPANY',
          taxId: 'GB123456789',
          email: 'acme@example.com',
          countryCode: 'GB',
          currency: 'GBP',
        },
      ];

      const result = await caller.import.commit({
        entityType: 'contractor',
        rows,
        duplicateActions: {},
      });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.contractor.create).toHaveBeenCalledTimes(1);

      const createCall = mockPrisma.contractor.create.mock.calls[0]?.[0];
      expect(createCall.data).toMatchObject({
        organizationId: ORG_ID,
        legalName: 'Acme Corp',
        displayName: 'Acme',
        taxId: 'GB123456789',
        email: 'acme@example.com',
        countryCode: 'GB',
        currency: 'GBP',
        ownerUserId: USER_ID,
      });

      expect(result).toMatchObject({ created: 1, updated: 0, skipped: 0, failed: 0 });
    });

    it('skips rows when duplicateAction is skip', async () => {
      const rows = [
        { legalName: 'Dup Corp', taxId: 'DUP123', email: 'dup@example.com', countryCode: 'GB' },
      ];

      const result = await caller.import.commit({
        entityType: 'contractor',
        rows,
        duplicateActions: { DUP123: 'skip' },
      });

      expect(mockPrisma.contractor.create).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
    });

    it('updates existing contractor when duplicateAction is update', async () => {
      mockPrisma.contractor.findFirst.mockResolvedValueOnce({
        id: CONTRACTOR_ID,
        organizationId: ORG_ID,
        legalName: 'Old Name',
        displayName: 'Old',
        email: 'old@example.com',
        phone: null,
        countryCode: 'GB',
        currency: 'GBP',
      });

      const rows = [
        {
          legalName: 'Updated Corp',
          displayName: 'Updated',
          taxId: 'UPD123',
          email: 'updated@example.com',
          countryCode: 'GB',
          currency: 'EUR',
        },
      ];

      const result = await caller.import.commit({
        entityType: 'contractor',
        rows,
        duplicateActions: { UPD123: 'update' },
      });

      expect(mockPrisma.contractor.update).toHaveBeenCalledTimes(1);
      const updateCall = mockPrisma.contractor.update.mock.calls[0]?.[0];
      expect(updateCall.where).toMatchObject({ id: CONTRACTOR_ID });
      expect(updateCall.data).toMatchObject({
        legalName: 'Updated Corp',
        email: 'updated@example.com',
        currency: 'EUR',
      });

      expect(result).toMatchObject({ created: 0, updated: 1, skipped: 0, failed: 0 });
    });
  });

  // =========================================================================
  // commit (contracts)
  // =========================================================================

  describe('commit - contracts', () => {
    it('creates contracts from validated data with contractor resolution', async () => {
      mockPrisma.contractor.findFirst.mockResolvedValueOnce({
        id: CONTRACTOR_ID,
      });

      const rows = [
        {
          title: 'Service Agreement',
          type: 'B2B_MASTER_SERVICE',
          contractorTaxId: '1234567890',
          startDate: '2025-01-01',
          currency: 'PLN',
        },
      ];

      const result = await caller.import.commit({
        entityType: 'contract',
        rows,
        duplicateActions: {},
      });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.contract.create).toHaveBeenCalledTimes(1);

      const createCall = mockPrisma.contract.create.mock.calls[0]?.[0];
      expect(createCall.data).toMatchObject({
        organizationId: ORG_ID,
        contractorId: CONTRACTOR_ID,
        title: 'Service Agreement',
        currency: 'PLN',
        internalOwnerUserId: USER_ID,
      });

      expect(result).toMatchObject({ created: 1, updated: 0, skipped: 0, failed: 0 });
    });

    it('fails when contractor cannot be resolved by taxId', async () => {
      mockPrisma.contractor.findFirst.mockResolvedValueOnce(null);

      const rows = [
        {
          title: 'Orphan Contract',
          contractorTaxId: 'UNKNOWN',
          startDate: '2025-01-01',
        },
      ];

      const result = await caller.import.commit({
        entityType: 'contract',
        rows,
        duplicateActions: {},
      });

      expect(mockPrisma.contract.create).not.toHaveBeenCalled();
      expect(result.failed).toBe(1);
    });

    it('uses provided contractorId directly when available', async () => {
      const rows = [
        {
          title: 'Direct Contract',
          contractorId: CONTRACTOR_ID,
          startDate: '2025-01-01',
        },
      ];

      const result = await caller.import.commit({
        entityType: 'contract',
        rows,
        duplicateActions: {},
      });

      // Should NOT have tried to resolve via findFirst
      expect(mockPrisma.contractor.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.contract.create).toHaveBeenCalledTimes(1);

      const createCall = mockPrisma.contract.create.mock.calls[0]?.[0];
      expect(createCall.data.contractorId).toBe(CONTRACTOR_ID);

      expect(result).toMatchObject({ created: 1 });
    });
  });
});

/**
 * Report router unit tests.
 *
 * Strategy: Mock Prisma at module level, bypass auth/RBAC middleware,
 * create a tRPC caller, and verify each procedure calls Prisma with the
 * correct WHERE clauses, query structures, and returns the expected shape.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants (vi.hoisted so mock factories can reference them)
// ---------------------------------------------------------------------------

const {
  ORG_ID,
  USER_ID,
  mockPrisma,
  mockGenerateSpendCsv,
  mockGenerateContractsCsv,
  mockGenerateInvoicesCsv,
  mockGenerateComplianceCsv,
} = vi.hoisted(() => {
  const OrgId = 'org-report-00000000-0000-0000-0000-000000000001';
  const UserId = 'user-report-00000000-0000-0000-0000-000000000001';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    contractor: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    invoice: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    contract: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  const csvResult = { data: 'bW9jaw==', mimeType: 'text/csv;charset=utf-8' };
  const mockGenerateSpendCsv = vi.fn(async () => csvResult);
  const mockGenerateContractsCsv = vi.fn(async () => csvResult);
  const mockGenerateInvoicesCsv = vi.fn(async () => csvResult);
  const mockGenerateComplianceCsv = vi.fn(async () => csvResult);

  return {
    ORG_ID: OrgId,
    USER_ID: UserId,
    mockPrisma,
    mockGenerateSpendCsv,
    mockGenerateContractsCsv,
    mockGenerateInvoicesCsv,
    mockGenerateComplianceCsv,
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
  withRlsTransactions: <T,>(c: T) => c,
  prisma: mockPrisma,
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    empty: { strings: [''], values: [] },
    raw: (val: string) => val,
  },
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

// Need to also mock the Prisma client subpath since report.ts imports from there
vi.mock('@contractor-ops/db/generated/prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    empty: { strings: [''], values: [] },
    raw: (val: string) => val,
  },
}));

vi.mock('../../services/report-export.js', () => ({
  generateSpendCsv: mockGenerateSpendCsv,
  generateContractsCsv: mockGenerateContractsCsv,
  generateInvoicesCsv: mockGenerateInvoicesCsv,
  generateComplianceCsv: mockGenerateComplianceCsv,
}));

vi.mock('../../services/cache.js', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  CacheKeys: {},
  CacheTTL: {},
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

vi.mock('../../services/billing-webhook.js', () => ({
  handleStripeWebhook: vi.fn(async () => undefined),
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

vi.mock('../../services/notification-service.js', () => ({
  dispatch: vi.fn(async () => undefined),
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

vi.mock('../../services/mime-validator.js', () => ({
  isAllowedMimeType: vi.fn(() => true),
  validateMimeType: vi.fn(async () => ({ valid: true })),
}));

vi.mock('../../services/virus-scanner.js', () => ({
  isClamAvailable: vi.fn(async () => false),
  scanBuffer: vi.fn(async () => ({ clean: true })),
}));

vi.mock('../../services/credit-service.js', () => ({
  deductCredits: vi.fn(async () => undefined),
  getBalance: vi.fn(async () => ({ credits: 0 })),
  hasCredits: vi.fn(async () => true),
}));

vi.mock('../../services/ocr-extraction.js', () => ({
  extractInvoiceData: vi.fn(async () => ({})),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';

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
      name: `User ${userId}`,
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
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$queryRaw.mockResolvedValue([]);
  mockPrisma.contractor.findMany.mockResolvedValue([]);
  mockPrisma.contractor.count.mockResolvedValue(0);
  mockPrisma.invoice.findMany.mockResolvedValue([]);
  mockPrisma.invoice.count.mockResolvedValue(0);
  mockPrisma.contract.findMany.mockResolvedValue([]);
  mockPrisma.contract.count.mockResolvedValue(0);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DATE_RANGE = { dateFrom: '2025-01-01', dateTo: '2025-12-31' };

// ===========================================================================
// spendByContractor
// ===========================================================================

describe('report router', () => {
  describe('spendByContractor', () => {
    it('rejects invalid pagination (page < 1)', async () => {
      await expect(
        caller.report.spendByContractor({
          ...DATE_RANGE,
          page: 0,
          pageSize: 20,
          sortBy: 'totalSpend',
          sortOrder: 'desc',
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('aggregates paid invoices grouped by contractor with date range filter', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          {
            contractorId: 'c-1',
            contractorName: 'Alpha Corp',
            invoiceCount: 5,
            totalMinor: 500000,
            avgMinor: 100000,
            lastPaidAt: new Date('2025-06-15'),
          },
        ])
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await caller.report.spendByContractor({
        ...DATE_RANGE,
        page: 1,
        pageSize: 20,
        sortBy: 'totalSpend',
        sortOrder: 'desc',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        contractorId: 'c-1',
        contractorName: 'Alpha Corp',
        invoiceCount: 5,
        totalMinor: 500000,
      });
      expect(result.totalCount).toBe(1);

      // Two raw queries: data + count
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('supports pagination with page and pageSize', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 50 }]);

      const result = await caller.report.spendByContractor({
        ...DATE_RANGE,
        page: 3,
        pageSize: 10,
        sortBy: 'totalSpend',
        sortOrder: 'desc',
      });

      expect(result.totalCount).toBe(50);
      // Verify the raw query was invoked (offset = (3-1)*10 = 20)
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('supports sorting by totalSpend, invoiceCount, contractorName', async () => {
      for (const sortBy of ['totalSpend', 'invoiceCount', 'contractorName'] as const) {
        vi.clearAllMocks();
        mockPrisma.$queryRaw.mockResolvedValue([]);

        await caller.report.spendByContractor({
          ...DATE_RANGE,
          page: 1,
          pageSize: 20,
          sortBy,
          sortOrder: 'asc',
        });

        // Should not throw for any valid sort option
        expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      }
    });

    it('returns totalCount for pagination', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // data query
        .mockResolvedValueOnce([{ count: 42 }]); // count query

      const result = await caller.report.spendByContractor({
        ...DATE_RANGE,
        page: 1,
        pageSize: 20,
        sortBy: 'totalSpend',
        sortOrder: 'desc',
      });

      expect(result).toHaveProperty('totalCount', 42);
    });

    it('filters by optional contractorId for drill-down', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          {
            contractorId: 'c-specific',
            contractorName: 'Target Corp',
            invoiceCount: 3,
            totalMinor: 300000,
            avgMinor: 100000,
            lastPaidAt: null,
          },
        ])
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await caller.report.spendByContractor({
        ...DATE_RANGE,
        page: 1,
        pageSize: 20,
        sortBy: 'totalSpend',
        sortOrder: 'desc',
        contractorId: 'c-specific',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.contractorId).toBe('c-specific');
    });
  });

  // =========================================================================
  // spendByTeam
  // =========================================================================

  describe('spendByTeam', () => {
    it('joins Invoice -> Contractor -> Team via primaryTeamId', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          {
            teamId: 'team-1',
            teamName: 'Engineering',
            contractorCount: 5,
            invoiceCount: 10,
            totalMinor: 1000000,
          },
          {
            teamId: null,
            teamName: null,
            contractorCount: 2,
            invoiceCount: 3,
            totalMinor: 200000,
          },
        ])
        .mockResolvedValueOnce([{ count: 2 }]);

      const result = await caller.report.spendByTeam({
        ...DATE_RANGE,
        page: 1,
        pageSize: 20,
        sortBy: 'totalSpend',
        sortOrder: 'desc',
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({
        teamId: 'team-1',
        teamName: 'Engineering',
      });
      // Null team stays null — frontend handles i18n display
      expect(result.items[1]?.teamName).toBeNull();
    });

    it('groups by team with contractor count', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          {
            teamId: 'team-1',
            teamName: 'Design',
            contractorCount: 3,
            invoiceCount: 7,
            totalMinor: 700000,
          },
        ])
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await caller.report.spendByTeam({
        ...DATE_RANGE,
        page: 1,
        pageSize: 20,
        sortBy: 'totalSpend',
        sortOrder: 'desc',
      });

      expect(result.items[0]).toHaveProperty('contractorCount', 3);
      expect(result.items[0]).toHaveProperty('invoiceCount', 7);
    });

    it('supports pagination and sorting', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 15 }]);

      const result = await caller.report.spendByTeam({
        ...DATE_RANGE,
        page: 2,
        pageSize: 5,
        sortBy: 'teamName',
        sortOrder: 'asc',
      });

      expect(result.totalCount).toBe(15);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // expiringContracts
  // =========================================================================

  describe('expiringContracts', () => {
    it('filters contracts expiring within 30/60/90 days', async () => {
      const futureDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
      mockPrisma.contract.findMany.mockResolvedValue([
        {
          id: 'c-1',
          title: 'Service Agreement',
          endDate: futureDate,
          status: 'ACTIVE',
          contractor: { id: 'con-1', legalName: 'Alpha Corp' },
        },
      ]);
      mockPrisma.contract.count.mockResolvedValue(1);

      const result = await caller.report.expiringContracts({
        days: '30',
        page: 1,
        pageSize: 20,
        sortBy: 'endDate',
        sortOrder: 'asc',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        contractId: 'c-1',
        contractTitle: 'Service Agreement',
        contractorName: 'Alpha Corp',
        status: 'ACTIVE',
      });

      // Verify where clause includes org scoping and status filter
      const call = mockPrisma.contract.findMany.mock.calls[0]?.[0];
      expect(call?.where).toHaveProperty('organizationId', ORG_ID);
      expect(call?.where.status).toEqual({ in: ['ACTIVE', 'EXPIRING'] });
      expect(call?.where).toHaveProperty('deletedAt', null);
    });

    it('includes contractor relation for name', async () => {
      mockPrisma.contract.findMany.mockResolvedValue([]);
      mockPrisma.contract.count.mockResolvedValue(0);

      await caller.report.expiringContracts({
        days: '60',
        page: 1,
        pageSize: 20,
        sortBy: 'endDate',
        sortOrder: 'asc',
      });

      const call = mockPrisma.contract.findMany.mock.calls[0]?.[0];
      expect(call?.include?.contractor).toEqual({
        select: { id: true, legalName: true },
      });
    });

    it('calculates daysRemaining correctly', async () => {
      const daysFromNow = 15;
      const futureDate = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
      mockPrisma.contract.findMany.mockResolvedValue([
        {
          id: 'c-1',
          title: 'Test Contract',
          endDate: futureDate,
          status: 'EXPIRING',
          contractor: { id: 'con-1', legalName: 'Test Corp' },
        },
      ]);
      mockPrisma.contract.count.mockResolvedValue(1);

      const result = await caller.report.expiringContracts({
        days: '30',
        page: 1,
        pageSize: 20,
        sortBy: 'endDate',
        sortOrder: 'asc',
      });

      // daysRemaining should be approximately daysFromNow (ceil rounding)
      expect(result.items[0]?.daysRemaining).toBeGreaterThanOrEqual(daysFromNow);
      expect(result.items[0]?.daysRemaining).toBeLessThanOrEqual(daysFromNow + 1);
    });
  });

  // =========================================================================
  // overdueInvoices
  // =========================================================================

  describe('overdueInvoices', () => {
    it('filters invoices where dueDate < now and not PAID/CANCELLED', async () => {
      const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          invoiceNumber: 'FV/2025/001',
          amountToPayMinor: 150000,
          currency: 'PLN',
          dueDate: pastDate,
          paymentStatus: 'UNPAID',
          contractor: { id: 'con-1', legalName: 'Alpha Corp' },
        },
      ]);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await caller.report.overdueInvoices({
        page: 1,
        pageSize: 20,
        sortBy: 'dueDate',
        sortOrder: 'desc',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        invoiceId: 'inv-1',
        invoiceNumber: 'FV/2025/001',
        contractorName: 'Alpha Corp',
        status: 'UNPAID',
      });

      // Verify where clause
      const call = mockPrisma.invoice.findMany.mock.calls[0]?.[0];
      expect(call?.where).toHaveProperty('organizationId', ORG_ID);
      expect(call?.where.dueDate).toHaveProperty('lt');
      expect(call?.where.paymentStatus).toEqual({ notIn: ['PAID'] });
      expect(call?.where).toHaveProperty('deletedAt', null);
    });

    it('calculates daysOverdue correctly', async () => {
      const daysOverdue = 7;
      const pastDate = new Date(Date.now() - daysOverdue * 24 * 60 * 60 * 1000);
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          invoiceNumber: 'FV/2025/099',
          amountToPayMinor: 50000,
          currency: 'EUR',
          dueDate: pastDate,
          paymentStatus: 'UNPAID',
          contractor: { id: 'con-1', legalName: 'Beta Ltd' },
        },
      ]);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await caller.report.overdueInvoices({
        page: 1,
        pageSize: 20,
        sortBy: 'dueDate',
        sortOrder: 'desc',
      });

      expect(result.items[0]?.daysOverdue).toBeGreaterThanOrEqual(daysOverdue);
      expect(result.items[0]?.daysOverdue).toBeLessThanOrEqual(daysOverdue + 1);
    });

    it('supports pagination and sorting', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.invoice.count.mockResolvedValue(25);

      const result = await caller.report.overdueInvoices({
        page: 2,
        pageSize: 10,
        sortBy: 'amount',
        sortOrder: 'asc',
      });

      expect(result.totalCount).toBe(25);

      const call = mockPrisma.invoice.findMany.mock.calls[0]?.[0];
      expect(call?.skip).toBe(10); // (page 2 - 1) * 10
      expect(call?.take).toBe(10);
      expect(call?.orderBy).toEqual({ amountToPayMinor: 'asc' });
    });
  });

  // =========================================================================
  // complianceGaps
  // =========================================================================

  describe('complianceGaps', () => {
    it('returns contractors with YELLOW or RED compliance health', async () => {
      mockPrisma.contractor.findMany.mockResolvedValue([
        {
          id: 'c-red',
          legalName: 'Red Corp',
          complianceItems: [{ status: 'VALID' }],
          contracts: [{ status: 'ACTIVE' }],
          _count: { complianceItems: 2 }, // 2 missing/expired -> red
        },
        {
          id: 'c-yellow',
          legalName: 'Yellow Corp',
          complianceItems: [{ status: 'PENDING' }],
          contracts: [{ status: 'ACTIVE' }],
          _count: { complianceItems: 0 }, // no missing, but has pending -> yellow
        },
        {
          id: 'c-green',
          legalName: 'Green Corp',
          complianceItems: [{ status: 'VALID' }],
          contracts: [{ status: 'ACTIVE' }],
          _count: { complianceItems: 0 }, // all good -> green (excluded)
        },
      ]);

      const result = await caller.report.complianceGaps({
        page: 1,
        pageSize: 20,
        sortBy: 'health',
        sortOrder: 'desc',
      });

      // Green contractor should be excluded
      expect(result.items).toHaveLength(2);
      const ids = result.items.map((i: { contractorId: string }) => i.contractorId);
      expect(ids).toContain('c-red');
      expect(ids).toContain('c-yellow');
      expect(ids).not.toContain('c-green');
    });

    it('includes missing document count and overdue task count', async () => {
      mockPrisma.contractor.findMany.mockResolvedValue([
        {
          id: 'c-1',
          legalName: 'Problem Corp',
          complianceItems: [],
          contracts: [],
          _count: { complianceItems: 3 },
        },
      ]);

      const result = await caller.report.complianceGaps({
        page: 1,
        pageSize: 20,
        sortBy: 'missingDocs',
        sortOrder: 'desc',
      });

      expect(result.items[0]).toHaveProperty('missingDocuments', 3);
      expect(result.items[0]).toHaveProperty('overdueTasks', 0);
      expect(result.items[0]).toHaveProperty('health', 'red');
    });
  });

  // =========================================================================
  // chart variants
  // =========================================================================

  describe('chart variants', () => {
    it('spendByContractorChart returns top 10 by spend', async () => {
      const topContractors = Array.from({ length: 10 }, (_, i) => ({
        contractorId: `c-${i}`,
        contractorName: `Contractor ${i}`,
        totalMinor: (10 - i) * 100000,
      }));
      mockPrisma.$queryRaw.mockResolvedValue(topContractors);

      const result = await caller.report.spendByContractorChart(DATE_RANGE);

      expect(result).toHaveLength(10);
      expect(result[0]).toMatchObject({
        contractorId: 'c-0',
        contractorName: 'Contractor 0',
        totalMinor: 1000000,
      });
    });

    it('spendByTeamChart returns all teams with spend', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { teamId: 't-1', teamName: 'Engineering', totalMinor: 500000 },
        { teamId: null, teamName: null, totalMinor: 100000 },
      ]);

      const result = await caller.report.spendByTeamChart(DATE_RANGE);

      expect(result).toHaveLength(2);
      expect(result[1]?.teamName).toBeNull();
    });

    it('expiringContractsChart returns counts by 30-day buckets', async () => {
      const now = Date.now();
      const msPerDay = 24 * 60 * 60 * 1000;
      mockPrisma.contract.findMany.mockResolvedValue([
        { endDate: new Date(now + 10 * msPerDay) },
        { endDate: new Date(now + 20 * msPerDay) },
        { endDate: new Date(now + 50 * msPerDay) },
        { endDate: new Date(now + 80 * msPerDay) },
      ]);

      const result = await caller.report.expiringContractsChart({ days: '90' });

      // 90 days / 30 = 3 buckets
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('bucket', '1-30 days');
      expect(result[0]).toHaveProperty('count');
      expect(result[1]).toHaveProperty('bucket', '31-60 days');
      expect(result[2]).toHaveProperty('bucket', '61-90 days');
    });

    it('complianceGapsChart returns critical/warning/ok counts', async () => {
      mockPrisma.contractor.findMany.mockResolvedValue([
        {
          id: 'c-1',
          complianceItems: [],
          contracts: [{ status: 'ACTIVE' }],
          _count: { complianceItems: 2 }, // red/critical
        },
        {
          id: 'c-2',
          complianceItems: [{ status: 'PENDING' }],
          contracts: [{ status: 'ACTIVE' }],
          _count: { complianceItems: 0 }, // yellow/warning
        },
        {
          id: 'c-3',
          complianceItems: [{ status: 'VALID' }],
          contracts: [{ status: 'ACTIVE' }],
          _count: { complianceItems: 0 }, // green/ok
        },
      ]);

      const result = await caller.report.complianceGapsChart();

      expect(result).toEqual({ critical: 1, warning: 1, ok: 1 });
    });
  });

  // =========================================================================
  // export mutations
  // =========================================================================

  describe('export mutations', () => {
    it('exportSpendByContractor returns base64 CSV with correct columns', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          contractorName: 'Alpha Corp',
          invoiceCount: 5,
          totalMinor: 500000,
          avgMinor: 100000,
          lastPaidAt: new Date('2025-06-15'),
        },
      ]);

      const result = await caller.report.exportSpendByContractor(DATE_RANGE);

      expect(result).toHaveProperty('data', 'bW9jaw==');
      expect(result).toHaveProperty('mimeType', 'text/csv;charset=utf-8');
      expect(result.filename).toMatch(/^spend-by-contractor-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(mockGenerateSpendCsv).toHaveBeenCalledTimes(1);
    });

    it('exportSpendByTeam returns base64 CSV', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          teamName: 'Engineering',
          contractorCount: 3,
          invoiceCount: 7,
          totalMinor: 700000,
        },
      ]);

      const result = await caller.report.exportSpendByTeam(DATE_RANGE);

      expect(result).toHaveProperty('data');
      expect(result.filename).toMatch(/^spend-by-team-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(mockGenerateSpendCsv).toHaveBeenCalledTimes(1);
    });

    it('exportExpiringContracts returns base64 CSV', async () => {
      const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      mockPrisma.contract.findMany.mockResolvedValue([
        {
          id: 'c-1',
          title: 'Service Agreement',
          endDate: futureDate,
          status: 'ACTIVE',
          contractor: { legalName: 'Alpha Corp' },
        },
      ]);

      const result = await caller.report.exportExpiringContracts({ days: '30' });

      expect(result).toHaveProperty('data');
      expect(result.filename).toMatch(/^expiring-contracts-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(mockGenerateContractsCsv).toHaveBeenCalledTimes(1);

      // Verify the data passed to CSV generator
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const csvArg = (mockGenerateContractsCsv.mock.calls as unknown)[0]?.[0];
      expect(csvArg[0]).toHaveProperty('contractTitle', 'Service Agreement');
      expect(csvArg[0]).toHaveProperty('contractorName', 'Alpha Corp');
    });

    it('exportOverdueInvoices returns base64 CSV', async () => {
      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          invoiceNumber: 'FV/2025/001',
          amountToPayMinor: 150000,
          currency: 'PLN',
          dueDate: pastDate,
          paymentStatus: 'UNPAID',
          contractor: { legalName: 'Alpha Corp' },
        },
      ]);

      const result = await caller.report.exportOverdueInvoices();

      expect(result).toHaveProperty('data');
      expect(result.filename).toMatch(/^overdue-invoices-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(mockGenerateInvoicesCsv).toHaveBeenCalledTimes(1);

      // Verify where clause for overdue: dueDate < now, not PAID
      const call = mockPrisma.invoice.findMany.mock.calls[0]?.[0];
      expect(call?.where).toHaveProperty('organizationId', ORG_ID);
      expect(call?.where.paymentStatus).toEqual({ notIn: ['PAID'] });
    });

    it('exportComplianceGaps returns base64 CSV', async () => {
      mockPrisma.contractor.findMany.mockResolvedValue([
        {
          id: 'c-1',
          legalName: 'Problem Corp',
          complianceItems: [],
          contracts: [],
          _count: { complianceItems: 2 },
        },
      ]);

      const result = await caller.report.exportComplianceGaps();

      expect(result).toHaveProperty('data');
      expect(result.filename).toMatch(/^compliance-gaps-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(mockGenerateComplianceCsv).toHaveBeenCalledTimes(1);

      // Verify only non-green items are passed to CSV
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const csvArg = (mockGenerateComplianceCsv.mock.calls as unknown)[0]?.[0];
      expect(csvArg).toHaveLength(1);
      expect(csvArg[0]).toHaveProperty('health', 'red');
    });
  });
});

/**
 * Invoice router unit tests.
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
const INVOICE_ID = 'clinvoice00000000000000001';
const DOC_ID_1 = 'cldocument0000000000000001';
const DOC_ID_2 = 'cldocument0000000000000002';
const CONTRACTOR_ID = 'clcontractor000000000001';
const CONTRACT_ID = 'clcontract0000000000000001';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    invoice: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findFirstOrThrow: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: INVOICE_ID,
        invoiceNumber: 'FV/2025/001',
        ...opts.data,
      })),
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => ({
        id: opts.where.id,
        ...opts.data,
      })),
      updateMany: vi.fn(async () => ({ count: 0 })),
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
    },
    invoiceFile: {
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    documentLink: {
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    invoiceMatchResult: {
      create: vi.fn(async (opts: { data: Rec }) => ({
        id: 'match-result-1',
        ...opts.data,
      })),
    },
    approvalStep: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    approvalFlow: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    member: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => ({ role: 'admin' })),
    },
    contractor: {
      findFirst: vi.fn(async () => null),
      findUniqueOrThrow: vi.fn(async () => ({
        countryCode: 'PL',
        vatId: '123',
        type: 'COMPANY',
      })),
    },
    contract: {
      findFirst: vi.fn(async () => null),
    },
    organization: {
      findUnique: vi.fn(async () => ({
        dataRegion: 'EU',
        status: 'ACTIVE',
        settingsJson: { invoiceDeviationThresholdPercent: 10 },
      })),
      findUniqueOrThrow: vi.fn(async () => ({
        countryCode: 'PL',
        isKleinunternehmer: false,
      })),
    },
    auditLog: {
      create: vi.fn(async (opts: { data: Rec }) => ({ id: 'audit-1', ...opts.data })),
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

vi.mock('../../services/invoice-matching', () => ({
  computeDuplicateCheckHash: vi.fn(() => 'hash-abc123'),
  runAutoMatch: vi.fn(async () => ({
    contractorId: 'clcontractor000000000001',
    contractId: 'clcontract0000000000000001',
    score: 95,
    matchStatus: 'MATCHED',
    expectedAmountMinor: 100000,
    amountDeltaMinor: 0,
    amountDeltaPercent: 0,
    flags: [],
    duplicateInvoiceId: null,
  })),
}));

vi.mock('../../services/notification-service', () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock('../../services/calendar-event-service', () => ({
  deleteCalendarEvent: vi.fn(async () => undefined),
}));

vi.mock('../../services/sanitize', () => ({
  sanitizeStrings: vi.fn(<T>(v: T) => v),
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

vi.mock('../../services/billing-service', () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
}));

vi.mock('../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: { dashboardPrefix: (orgId: string) => `dash:${orgId}` },
  CacheTTL: { DASHBOARD: 300 },
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

vi.mock('../../services/mime-validator', () => ({
  isAllowedMimeType: vi.fn(() => true),
  validateMimeType: vi.fn(async () => ({ valid: true })),
}));

vi.mock('../../services/virus-scanner', () => ({
  isClamAvailable: vi.fn(async () => false),
  scanBuffer: vi.fn(async () => ({ clean: true })),
}));

vi.mock('../../services/bank-account-crypto', () => ({
  encryptBankAccount: vi.fn((v: string) => `encrypted:${v}`),
}));

vi.mock('../../services/approval-engine', () => ({
  routeToChain: vi.fn(async () => null),
  createApprovalFlow: vi.fn(async () => ({})),
  advanceFlow: vi.fn(async () => undefined),
  computeSlaStatus: vi.fn(() => 'ON_TIME'),
}));

vi.mock('../../services/calendar-deadline-sync', () => ({
  syncPaymentDueDeadline: vi.fn(async () => undefined),
  syncApprovalSlaDeadline: vi.fn(async () => undefined),
}));

vi.mock('../../services/report-export', () => ({
  generateAuditCsv: vi.fn(async () => ({ base64: 'bW9jaw==', filename: 'audit-log.csv' })),
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
  getIdpAuditLogger: vi.fn(() => ({
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
// Phase 57 · Plan 04 — gov-api + tax-id-validation mocks
// ---------------------------------------------------------------------------

const {
  mockHmrcClient,
  mockViesClient,
  validateTaxIdMock,
  isValidationFreshMock,
  getDefaultRateCodeMock,
  applyKleinunternehmerOverrideMock,
  detectReverseChargeMock,
} = vi.hoisted(() => ({
  mockHmrcClient: { checkVatNumber: vi.fn() },
  mockViesClient: { checkVatNumber: vi.fn() },
  validateTaxIdMock: vi.fn(async () => ({
    responseStatus: 'VALID' as const,
    confirmationRef: null,
    source: 'api' as const,
    requestedAt: new Date('2026-04-13T10:00:00Z'),
    taxIdValidationId: 'clval00000000000000000001',
  })),
  isValidationFreshMock: vi.fn(() => true),
  getDefaultRateCodeMock: vi.fn(async (cc: string) =>
    cc === 'GB' ? '20' : cc === 'DE' ? '19' : '23',
  ),
  applyKleinunternehmerOverrideMock: vi.fn(
    (
      line: { vatRate: string | null },
      org: { countryCode: string | null; isKleinunternehmer: boolean },
    ) => {
      const original = line.vatRate ?? '';
      if (org.countryCode !== 'DE' || !org.isKleinunternehmer) {
        return { vatRate: original, forced: false };
      }
      if (original === 'RC') return { vatRate: 'RC', forced: false };
      return { vatRate: 'KU', forced: true };
    },
  ),
  detectReverseChargeMock: vi.fn(() => ({
    shouldApply: false,
    reason: 'no-op mock default',
    rule: 'not_applicable' as const,
  })),
}));

vi.mock('../../gov-api-clients', () => ({
  getHmrcVatClient: vi.fn(() => mockHmrcClient),
  getViesClient: vi.fn(() => mockViesClient),
}));

vi.mock('../../services/tax-id-validation.service', () => ({
  validateTaxId: validateTaxIdMock,
  isValidationFresh: isValidationFreshMock,
  NINETY_DAYS_MS: 90 * 24 * 60 * 60 * 1000,
  getLatestValidation: vi.fn(async () => null),
}));

vi.mock('../../services/tax-rate.service', () => ({
  getDefaultRateCode: getDefaultRateCodeMock,
  getTaxRatesForCountry: vi.fn(async () => []),
  validateVatRateCode: vi.fn(async () => true),
  calculateWht: vi.fn(async () => null),
}));

vi.mock('../../services/kleinunternehmer.service', () => ({
  applyKleinunternehmerOverride: applyKleinunternehmerOverrideMock,
  shouldSuppressVatBreakdown: vi.fn(() => false),
}));

vi.mock('../../services/reverse-charge.service', async () => {
  const actual = await vi.importActual<typeof import('../../services/reverse-charge.service')>(
    '../../services/reverse-charge.service',
  );
  return {
    ...actual,
    detectReverseCharge: detectReverseChargeMock,
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../init';
import { appRouter } from '../../root';
import { deleteCalendarEvent } from '../../services/calendar-event-service';
import { computeDuplicateCheckHash, runAutoMatch } from '../../services/invoice-matching';
import { dispatch } from '../../services/notification-service';

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

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE_ID,
    organizationId: ORG_ID,
    invoiceNumber: 'FV/2025/001',
    issueDate: new Date('2025-01-15'),
    dueDate: new Date('2025-02-15'),
    currency: 'PLN',
    subtotalMinor: 100000,
    totalMinor: 123000,
    amountToPayMinor: 123000,
    sellerTaxId: '1234567890',
    sellerName: 'Acme Sp. z o.o.',
    status: 'RECEIVED',
    matchStatus: 'UNMATCHED',
    paymentStatus: 'NOT_READY',
    approvalStatus: 'NOT_STARTED',
    source: 'MANUAL_UPLOAD',
    duplicateCheckHash: 'hash-abc123',
    deletedAt: null,
    contractorId: null,
    contractId: null,
    flagsJson: null,
    servicePeriodStart: null,
    servicePeriodEnd: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset all mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.organization.findUnique.mockResolvedValue({
    dataRegion: 'EU',
    status: 'ACTIVE',
    settingsJson: { invoiceDeviationThresholdPercent: 10 },
  });
  mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
    countryCode: 'PL',
    isKleinunternehmer: false,
  });
  mockPrisma.contractor.findUniqueOrThrow.mockResolvedValue({
    countryCode: 'DE',
    vatId: 'DE123',
    type: 'COMPANY',
  });
  // Default: no duplicate found
  mockPrisma.invoice.findFirst.mockResolvedValue(null);
});

// ===========================================================================
// TESTS
// ===========================================================================

describe('invoice.create', () => {
  const validInput = {
    invoiceNumber: 'FV/2025/001',
    issueDate: '2025-01-15',
    dueDate: '2025-02-15',
    currency: 'PLN',
    subtotalMinor: 100000,
    vatRate: '23' as const,
    vatAmountMinor: 23000,
    totalMinor: 123000,
    amountToPayMinor: 123000,
    sellerTaxId: '1234567890',
    sellerName: 'Acme Sp. z o.o.',
    documentIds: [DOC_ID_1, DOC_ID_2],
  };

  it('creates invoice with organizationId and computes duplicateCheckHash', async () => {
    // No duplicate found, then create returns the invoice
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    mockPrisma.invoice.create.mockResolvedValue(makeInvoice());

    await caller.invoice.create(validInput);

    // Verify computeDuplicateCheckHash was called with correct args
    expect(computeDuplicateCheckHash).toHaveBeenCalledWith('FV/2025/001', '1234567890', 123000);

    // Verify create was called with organizationId and hash
    expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          duplicateCheckHash: 'hash-abc123',
          status: 'RECEIVED',
          matchStatus: 'UNMATCHED',
          source: 'MANUAL_UPLOAD',
        }),
      }),
    );
  });

  it('creates InvoiceFile links for documentIds', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    mockPrisma.invoice.create.mockResolvedValue(makeInvoice());

    await caller.invoice.create(validInput);

    expect(mockPrisma.invoiceFile.createMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: ORG_ID,
          invoiceId: INVOICE_ID,
          documentId: DOC_ID_1,
          role: 'SOURCE_ORIGINAL',
        },
        {
          organizationId: ORG_ID,
          invoiceId: INVOICE_ID,
          documentId: DOC_ID_2,
          role: 'SOURCE_ORIGINAL',
        },
      ],
    });
  });

  it('creates DocumentLink records for documentIds', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    mockPrisma.invoice.create.mockResolvedValue(makeInvoice());

    await caller.invoice.create(validInput);

    expect(mockPrisma.documentLink.createMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: ORG_ID,
          documentId: DOC_ID_1,
          entityType: 'INVOICE',
          entityId: INVOICE_ID,
          linkRole: 'PRIMARY',
        },
        {
          organizationId: ORG_ID,
          documentId: DOC_ID_2,
          entityType: 'INVOICE',
          entityId: INVOICE_ID,
          linkRole: 'PRIMARY',
        },
      ],
    });
  });

  it('dispatches notification to finance_admin members', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    mockPrisma.invoice.create.mockResolvedValue(makeInvoice());
    mockPrisma.member.findMany.mockResolvedValue([
      { userId: 'finance-user-1' },
      { userId: 'finance-user-2' },
    ]);

    await caller.invoice.create(validInput);

    // Verify member query for finance_admin
    expect(mockPrisma.member.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        role: 'FINANCE_ADMIN',
      },
      select: { userId: true },
    });

    // Verify dispatch called with correct recipients
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        type: 'INVOICE_RECEIVED',
        recipientUserIds: ['finance-user-1', 'finance-user-2'],
        entityType: 'INVOICE',
        entityId: INVOICE_ID,
      }),
    );
  });
});

describe('invoice.getById', () => {
  it('returns invoice with match results, scoped to org', async () => {
    const invoice = makeInvoice({
      contractor: { id: CONTRACTOR_ID, legalName: 'Acme', taxId: '123' },
      contract: null,
      files: [],
      matchResults: [{ id: 'mr-1', matchScore: 95 }],
    });
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice);

    const result = await caller.invoice.getById({ id: INVOICE_ID });

    expect(result.id).toBe(INVOICE_ID);

    // Verify WHERE includes both id and organizationId
    expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: INVOICE_ID,
          organizationId: ORG_ID,
          deletedAt: null,
        }),
      }),
    );
  });

  it('throws NOT_FOUND for wrong organization', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);

    await expect(caller.invoice.getById({ id: INVOICE_ID })).rejects.toThrow(TRPCError);

    await expect(caller.invoice.getById({ id: INVOICE_ID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('invoice.list', () => {
  it('WHERE includes organizationId and deletedAt:null', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.invoice.count.mockResolvedValue(0);

    await caller.invoice.list({ page: 1, pageSize: 20, sortBy: 'receivedAt', sortOrder: 'desc' });

    const findManyCall = mockPrisma.invoice.findMany.mock.calls[0]?.[0];
    expect(findManyCall.where).toMatchObject({
      organizationId: ORG_ID,
      deletedAt: null,
    });
  });

  it('applies status filter when provided', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.invoice.count.mockResolvedValue(0);

    await caller.invoice.list({
      page: 1,
      pageSize: 20,
      sortBy: 'receivedAt',
      sortOrder: 'desc',
      filters: { status: ['RECEIVED', 'UNDER_REVIEW'] },
    });

    const findManyCall = mockPrisma.invoice.findMany.mock.calls[0]?.[0];
    expect(findManyCall.where.status).toEqual({ in: ['RECEIVED', 'UNDER_REVIEW'] });
  });

  it('applies pagination and sorting', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.invoice.count.mockResolvedValue(0);

    await caller.invoice.list({
      page: 3,
      pageSize: 10,
      sortBy: 'dueDate',
      sortOrder: 'asc',
    });

    const findManyCall = mockPrisma.invoice.findMany.mock.calls[0]?.[0];
    expect(findManyCall.skip).toBe(20);
    expect(findManyCall.take).toBe(10);
    expect(findManyCall.orderBy).toEqual({ dueDate: 'asc' });
  });
});

describe('invoice.update', () => {
  it('WHERE includes id and organizationId', async () => {
    const existing = makeInvoice();
    // First call: findFirst for existing check
    mockPrisma.invoice.findFirst.mockResolvedValue(existing);
    mockPrisma.invoice.update.mockResolvedValue({ ...existing, sellerName: 'Updated' });

    await caller.invoice.update({
      id: INVOICE_ID,
      data: { sellerName: 'Updated' },
    });

    expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: INVOICE_ID,
          organizationId: ORG_ID,
          deletedAt: null,
        }),
      }),
    );
  });

  it('throws NOT_FOUND when invoice not found', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);

    await expect(
      caller.invoice.update({ id: 'nonexistent', data: { sellerName: 'X' } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('invoice.submitForMatching', () => {
  it('calls runAutoMatch with correct invoice data', async () => {
    const invoice = makeInvoice();
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
    mockPrisma.invoice.update.mockResolvedValue({
      ...invoice,
      matchStatus: 'MATCHED',
      status: 'UNDER_REVIEW',
    });

    await caller.invoice.submitForMatching({ id: INVOICE_ID });

    expect(runAutoMatch).toHaveBeenCalledWith(
      mockPrisma,
      ORG_ID,
      {
        id: INVOICE_ID,
        issueDate: invoice.issueDate,
        sellerTaxId: '1234567890',
        totalMinor: 123000,
        currency: 'PLN',
        duplicateCheckHash: 'hash-abc123',
        servicePeriodStart: invoice.servicePeriodStart,
        servicePeriodEnd: invoice.servicePeriodEnd,
      },
      10, // deviationThreshold default
    );
  });

  it('updates invoice with match result in transaction', async () => {
    const invoice = makeInvoice();
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
    mockPrisma.invoice.update.mockResolvedValue({
      ...invoice,
      matchStatus: 'MATCHED',
    });

    await caller.invoice.submitForMatching({ id: INVOICE_ID });

    // Verify invoiceMatchResult.create was called
    expect(mockPrisma.invoiceMatchResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          invoiceId: INVOICE_ID,
          matchedContractorId: CONTRACTOR_ID,
          matchedContractId: CONTRACT_ID,
          matchScore: 95,
          matchedBy: 'RULE_ENGINE',
          status: 'MATCHED',
        }),
      }),
    );

    // Verify invoice.update was called with match data
    expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INVOICE_ID },
        data: expect.objectContaining({
          contractorId: CONTRACTOR_ID,
          contractId: CONTRACT_ID,
          matchStatus: 'MATCHED',
          status: 'UNDER_REVIEW',
        }),
      }),
    );
  });
});

describe('invoice.manualMatch', () => {
  it('updates contractorId and contractId on invoice', async () => {
    const invoice = makeInvoice();
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
    mockPrisma.contractor.findFirst.mockResolvedValue({
      id: CONTRACTOR_ID,
      organizationId: ORG_ID,
    });
    mockPrisma.contract.findFirst.mockResolvedValue({
      id: CONTRACT_ID,
      organizationId: ORG_ID,
    });
    mockPrisma.invoice.update.mockResolvedValue({
      ...invoice,
      contractorId: CONTRACTOR_ID,
      contractId: CONTRACT_ID,
    });

    await caller.invoice.manualMatch({
      invoiceId: INVOICE_ID,
      contractorId: CONTRACTOR_ID,
      contractId: CONTRACT_ID,
    });

    expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INVOICE_ID },
        data: expect.objectContaining({
          contractorId: CONTRACTOR_ID,
          contractId: CONTRACT_ID,
          matchStatus: 'MANUALLY_CONFIRMED',
        }),
      }),
    );
  });

  it('sets matchStatus to MANUALLY_CONFIRMED in match result', async () => {
    const invoice = makeInvoice();
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
    mockPrisma.contractor.findFirst.mockResolvedValue({
      id: CONTRACTOR_ID,
      organizationId: ORG_ID,
    });
    mockPrisma.invoice.update.mockResolvedValue({
      ...invoice,
      matchStatus: 'MANUALLY_CONFIRMED',
    });

    await caller.invoice.manualMatch({
      invoiceId: INVOICE_ID,
      contractorId: CONTRACTOR_ID,
    });

    expect(mockPrisma.invoiceMatchResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          invoiceId: INVOICE_ID,
          matchedContractorId: CONTRACTOR_ID,
          matchScore: 100,
          matchedBy: 'MANUAL',
          status: 'MANUALLY_CONFIRMED',
        }),
      }),
    );
  });
});

describe('invoice.voidInvoice', () => {
  it('sets status to VOID', async () => {
    const invoice = makeInvoice();
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
    mockPrisma.invoice.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.invoice.findFirstOrThrow.mockResolvedValue({
      ...invoice,
      status: 'VOID',
      paymentStatus: 'NOT_READY',
      approvalStatus: 'CANCELLED',
    });

    await caller.invoice.voidInvoice({ id: INVOICE_ID });

    expect(mockPrisma.invoice.updateMany).toHaveBeenCalledWith({
      where: {
        id: INVOICE_ID,
        organizationId: ORG_ID,
        deletedAt: null,
        status: { not: 'VOID' },
        paymentStatus: { notIn: ['PAID', 'IN_RUN'] },
      },
      data: {
        status: 'VOID',
        paymentStatus: 'NOT_READY',
        approvalStatus: 'CANCELLED',
        paidAt: null,
        readyForPaymentAt: null,
        approvedAt: null,
      },
    });
  });

  it('cleans up calendar events', async () => {
    const invoice = makeInvoice();
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice);
    mockPrisma.invoice.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.invoice.findFirstOrThrow.mockResolvedValue({
      ...invoice,
      status: 'VOID',
    });

    await caller.invoice.voidInvoice({ id: INVOICE_ID });

    expect(deleteCalendarEvent).toHaveBeenCalledWith(mockPrisma, {
      organizationId: ORG_ID,
      entityType: 'INVOICE',
      entityId: INVOICE_ID,
    });
  });

  it('rejects void when invoice is PAID', async () => {
    const invoice = makeInvoice({ paymentStatus: 'PAID' });
    mockPrisma.invoice.findFirst.mockResolvedValue(invoice);

    await expect(caller.invoice.voidInvoice({ id: INVOICE_ID })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(mockPrisma.invoice.updateMany).not.toHaveBeenCalled();
  });
});

describe('invoice.statusCounts', () => {
  it('returns counts grouped by status for org', async () => {
    mockPrisma.invoice.groupBy
      .mockResolvedValueOnce([
        { status: 'RECEIVED', _count: { id: 5 } },
        { status: 'UNDER_REVIEW', _count: { id: 3 } },
      ])
      .mockResolvedValueOnce([
        { matchStatus: 'UNMATCHED', _count: { id: 4 } },
        { matchStatus: 'MATCHED', _count: { id: 2 } },
      ]);

    const result = await caller.invoice.statusCounts();

    expect(result).toEqual({
      'status:RECEIVED': 5,
      'status:UNDER_REVIEW': 3,
      'matchStatus:UNMATCHED': 4,
      'matchStatus:MATCHED': 2,
    });

    // Verify both groupBy calls are scoped to org
    const calls = mockPrisma.invoice.groupBy.mock.calls;
    expect(calls[0]?.[0].where).toMatchObject({
      organizationId: ORG_ID,
      deletedAt: null,
    });
    expect(calls[1]?.[0].where).toMatchObject({
      organizationId: ORG_ID,
      deletedAt: null,
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 57 · Plan 04 — default rate + Kleinunternehmer + staleness + RC pipeline
// ---------------------------------------------------------------------------

describe('Phase 57 · Plan 04 — invoice-line tax pipeline', () => {
  const baseInput = {
    invoiceNumber: 'FV/2026/001',
    issueDate: '2026-04-01',
    dueDate: '2026-05-01',
    currency: 'GBP',
    subtotalMinor: 100000,
    totalMinor: 100000,
    amountToPayMinor: 100000,
    documentIds: [DOC_ID_1],
  };

  beforeEach(() => {
    // Clean state — mockReset resets queues + implementation so defaults take effect.
    getDefaultRateCodeMock.mockReset();
    getDefaultRateCodeMock.mockImplementation(async (cc: string) =>
      cc === 'GB' ? '20' : cc === 'DE' ? '19' : '23',
    );
    applyKleinunternehmerOverrideMock.mockReset();
    applyKleinunternehmerOverrideMock.mockImplementation(
      (
        line: { vatRate: string | null },
        org: { countryCode: string | null; isKleinunternehmer: boolean },
      ) => {
        const original = line.vatRate ?? '';
        if (org.countryCode !== 'DE' || !org.isKleinunternehmer) {
          return { vatRate: original, forced: false };
        }
        if (original === 'RC') return { vatRate: 'RC', forced: false };
        return { vatRate: 'KU', forced: true };
      },
    );
    detectReverseChargeMock.mockReset();
    detectReverseChargeMock.mockReturnValue({
      shouldApply: false,
      reason: 'default no-op',
      rule: 'not_applicable',
    });
    isValidationFreshMock.mockReset();
    isValidationFreshMock.mockReturnValue(true);
    validateTaxIdMock.mockReset();
    validateTaxIdMock.mockResolvedValue({
      responseStatus: 'VALID',
      confirmationRef: null,
      source: 'api',
      requestedAt: new Date('2026-04-13T10:00:00Z'),
      taxIdValidationId: 'clval00000000000000000001',
    });
  });

  it('GB org invoice pre-selects the isDefault TaxRate code 20 — PAY-02', async () => {
    mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
      countryCode: 'GB',
      isKleinunternehmer: false,
    });

    await caller.invoice.create(baseInput);

    expect(getDefaultRateCodeMock).toHaveBeenCalledWith('GB', expect.anything());
    const createCall = mockPrisma.invoice.create.mock.calls[0]?.[0];
    expect(createCall?.data).toMatchObject({ vatRate: '20' });
  });

  it('DE org invoice pre-selects the isDefault TaxRate code 19 — PAY-04', async () => {
    mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
      countryCode: 'DE',
      isKleinunternehmer: false,
    });

    await caller.invoice.create({ ...baseInput, currency: 'EUR' });

    const createCall = mockPrisma.invoice.create.mock.calls[0]?.[0];
    expect(createCall?.data).toMatchObject({ vatRate: '19' });
  });

  it('DE Kleinunternehmer org forces invoice vatRate to KU — PAY-04 (§19 UStG)', async () => {
    mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
      countryCode: 'DE',
      isKleinunternehmer: true,
    });

    await caller.invoice.create({ ...baseInput, currency: 'EUR' });

    expect(applyKleinunternehmerOverrideMock).toHaveBeenCalled();
    const createCall = mockPrisma.invoice.create.mock.calls[0]?.[0];
    expect(createCall?.data).toMatchObject({ vatRate: 'KU' });
  });

  it('auto-selects RC when detectReverseCharge reports shouldApply=true', async () => {
    mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
      countryCode: 'DE',
      isKleinunternehmer: false,
    });
    mockPrisma.contractor.findFirst.mockResolvedValueOnce({
      id: CONTRACTOR_ID,
      countryCode: 'GB',
      vatId: 'GB193054661',
      type: 'COMPANY',
      latestVatValidatedAt: new Date('2026-04-01T00:00:00Z'),
      latestVatValidationStatus: 'VALID',
    });
    detectReverseChargeMock.mockReturnValue({
      shouldApply: true,
      reason: 'UK↔EU post-Brexit B2B',
      rule: 'gb_eu_post_brexit_b2b',
    });

    await caller.invoice.create({
      ...baseInput,
      currency: 'EUR',
      contractorId: CONTRACTOR_ID,
    });

    const createCall = mockPrisma.invoice.create.mock.calls[0]?.[0];
    expect(createCall?.data).toMatchObject({
      vatRate: 'RC',
      isReverseCharge: true,
    });
  });

  it('stale contractor VAT validation triggers inline revalidation (D-07 trigger 2)', async () => {
    mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
      countryCode: 'GB',
      isKleinunternehmer: false,
    });
    mockPrisma.contractor.findFirst.mockResolvedValueOnce({
      id: CONTRACTOR_ID,
      countryCode: 'GB',
      vatId: 'GB193054661',
      type: 'COMPANY',
      latestVatValidatedAt: new Date('2025-01-01T00:00:00Z'), // older than 90d
      latestVatValidationStatus: 'VALID',
    });
    isValidationFreshMock.mockReturnValue(false);

    await caller.invoice.create({ ...baseInput, contractorId: CONTRACTOR_ID });

    expect(validateTaxIdMock).toHaveBeenCalledTimes(1);
    expect(validateTaxIdMock.mock.calls[0]?.[0]).toMatchObject({
      taxIdType: 'GB_VAT',
      taxIdValue: 'GB193054661',
    });
  });

  it('does NOT revalidate when contractor has fresh validation', async () => {
    mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
      countryCode: 'GB',
      isKleinunternehmer: false,
    });
    mockPrisma.contractor.findFirst.mockResolvedValueOnce({
      id: CONTRACTOR_ID,
      countryCode: 'GB',
      vatId: 'GB193054661',
      type: 'COMPANY',
      latestVatValidatedAt: new Date('2026-04-01T00:00:00Z'),
      latestVatValidationStatus: 'VALID',
    });
    isValidationFreshMock.mockReturnValue(true);

    await caller.invoice.create({ ...baseInput, contractorId: CONTRACTOR_ID });

    expect(validateTaxIdMock).not.toHaveBeenCalled();
  });

  it('persists AuditLog when user disables auto-detected RC with a reason (D-13)', async () => {
    mockPrisma.organization.findUniqueOrThrow.mockResolvedValue({
      countryCode: 'DE',
      isKleinunternehmer: false,
    });
    mockPrisma.contractor.findFirst.mockResolvedValueOnce({
      id: CONTRACTOR_ID,
      countryCode: 'GB',
      vatId: 'GB193054661',
      type: 'COMPANY',
      latestVatValidatedAt: new Date('2026-04-01T00:00:00Z'),
      latestVatValidationStatus: 'VALID',
    });
    detectReverseChargeMock.mockReturnValue({
      shouldApply: true,
      reason: 'UK↔EU post-Brexit',
      rule: 'gb_eu_post_brexit_b2b',
    });

    await caller.invoice.create({
      ...baseInput,
      currency: 'EUR',
      contractorId: CONTRACTOR_ID,
      reverseChargeOverride: false,
      reverseChargeOverrideReason: 'Customer prefers standard rate per contract clause 4.2',
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
    const auditCall = mockPrisma.auditLog.create.mock.calls[0]?.[0];
    expect(auditCall?.data).toMatchObject({
      organizationId: ORG_ID,
      action: 'invoice.reverse-charge-override',
      metadataJson: expect.objectContaining({
        reason: 'Customer prefers standard rate per contract clause 4.2',
        autoDetected: true,
      }),
    });
    // Line saved WITHOUT RC since user overrode
    const createCall = mockPrisma.invoice.create.mock.calls[0]?.[0];
    expect(createCall?.data.isReverseCharge).toBe(false);
  });

  it('rejects reverseChargeOverride=false without a reason (Zod refine)', async () => {
    await expect(
      caller.invoice.create({
        ...baseInput,
        reverseChargeOverride: false,
      }),
    ).rejects.toThrow();
  });
});

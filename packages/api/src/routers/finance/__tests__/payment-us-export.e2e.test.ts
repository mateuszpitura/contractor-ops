/**
 * End-to-end lockAndExport US-export scaffold.
 *
 * Mirrors the payment.test.ts lockAndExport harness (vi.hoisted mockPrisma +
 * tRPC caller via createCallerFactory) but keeps the REAL payment-export
 * generators so the emitted NACHA / Fedwire bytes can be asserted. The US
 * routing/account are decrypted through a reversible bank-account-crypto mock so
 * the file's entry can be checked against known synthetic values.
 *
 * Both cases FAIL today: lockAndExport rejects ACH_NACHA / FEDWIRE at Zod input
 * validation (paymentExportFormatEnum omits them), and even past that the US
 * routing/account are never populated by _buildExportItems. Enabling the enum +
 * the US-field mapping turns both green.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
const USER_ID = 'clyyyyyyyyyyyyyyyyyyyyyyyy';
const INVOICE_ID_1 = 'clinvoice00000000000000001';
const CONTRACTOR_ID = 'clcontractor000000000001';
const RUN_ID = 'clrun000000000000000000001';
const ITEM_ID = 'clitem00000000000000000001';

// Synthetic US bank details — never real routing/account numbers.
const US_ROUTING = '123456789';
const US_ACCOUNT = '000987654321';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    invoice: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => ({
        id: opts.where.id,
        ...opts.data,
      })),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    paymentRun: {
      findFirst: vi.fn(async () => null),
      findFirstOrThrow: vi.fn(async () => ({ id: RUN_ID, status: 'EXPORTED' })),
      update: vi.fn(async (opts: { where: Rec; data: Rec }) => ({
        id: opts.where.id,
        ...opts.data,
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    paymentRunItem: {
      findMany: vi.fn(async () => []),
      aggregate: vi.fn(async () => ({ _sum: { amountMinor: 0 }, _count: 0 })),
    },
    paymentExport: {
      create: vi.fn(async (opts: { data: Rec }) => ({ id: 'export-1', ...opts.data })),
    },
    auditLog: {
      create: vi.fn(async () => ({})),
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    organization: {
      findUnique: vi.fn(async () => ({
        name: 'US Test Org',
        metadata: JSON.stringify({ settingsJson: {} }),
      })),
      findUniqueOrThrow: vi.fn(async () => ({
        id: ORG_ID,
        name: 'US Test Org',
        dataRegion: 'US',
        status: 'ACTIVE',
      })),
    },
    member: {
      findFirst: vi.fn(async () => ({ role: 'admin' })),
    },
    contractorComplianceItem: {
      findMany: vi.fn(async () => []),
    },
    paymentRunComplianceCheck: {
      create: vi.fn(async (opts: { data: Rec }) => ({ id: 'compliance-check-1', ...opts.data })),
    },
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
    $executeRawUnsafe: vi.fn(async () => 0),
  };

  return { mockPrisma };
});

// ---------------------------------------------------------------------------
// Mock modules (mirrors payment.test.ts; payment-export is intentionally REAL)
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
    getStore: vi.fn(() => ({ region: 'US' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

vi.mock('../../../services/org-cache', () => ({
  getOrgMeta: vi.fn(async () => ({
    id: ORG_ID,
    dataRegion: 'US',
    status: 'ACTIVE',
    name: 'US Test Org',
  })),
  invalidateOrgMeta: vi.fn(async () => undefined),
  ORG_META_TTL_SECONDS: 300,
  orgMetaKey: (orgId: string) => `org:${orgId}:meta`,
}));

vi.mock('../../../services/r2', () => ({
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

vi.mock('../../../services/notification-service', () => ({
  dispatch: vi.fn(async () => undefined),
}));

vi.mock('../../../services/invoice-matching', () => ({
  computeDuplicateCheckHash: vi.fn(() => 'hash'),
  runAutoMatch: vi.fn(async () => undefined),
}));

// Reversible so the fixture's encrypted US fields round-trip back to the
// synthetic routing/account inside _buildExportItems.
vi.mock('../../../services/bank-account-crypto', () => ({
  encryptBankAccount: vi.fn((v: string) => `enc:${v}`),
  decryptBankAccount: vi.fn((e: string) => e.replace(/^enc:/, '')),
}));

vi.mock('../../../services/sanitize', () => ({
  sanitizeStrings: vi.fn(<T>(v: T) => v),
}));

vi.mock('../../../services/approval-engine', () => ({
  routeToChain: vi.fn(async () => null),
  createApprovalFlow: vi.fn(async () => ({})),
  advanceFlow: vi.fn(async () => undefined),
  computeSlaStatus: vi.fn(() => 'ON_TIME'),
}));

vi.mock('../../../services/calendar-event-service', () => ({
  deleteCalendarEvent: vi.fn(async () => undefined),
}));

vi.mock('../../../services/calendar-deadline-sync', () => ({
  syncPaymentDueDeadline: vi.fn(async () => undefined),
  syncApprovalSlaDeadline: vi.fn(async () => undefined),
}));

vi.mock('../../../services/report-export', () => ({
  generateAuditCsv: vi.fn(async () => ({ base64: 'bW9jaw==', filename: 'audit-log.csv' })),
}));

vi.mock('../../../services/billing-service', () => ({
  syncSeatCountForOrg: vi.fn(async () => undefined),
}));

vi.mock('../../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: { approvalChains: (orgId: string) => `approval-chains:${orgId}` },
  CacheTTL: { APPROVAL_CHAINS: 300 },
}));

vi.mock('../../../services/mime-validator', () => ({
  isAllowedMimeType: vi.fn(() => true),
  validateMimeType: vi.fn(async () => ({ valid: true })),
}));

vi.mock('../../../services/virus-scanner', () => ({
  isClamAvailable: vi.fn(async () => false),
  scanBuffer: vi.fn(async () => ({ clean: true })),
}));

vi.mock('../../../services/stripe-client', () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn(), update: vi.fn(), list: vi.fn(async () => ({ data: [] })) },
    customers: { create: vi.fn(), retrieve: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    invoices: { retrieveUpcoming: vi.fn() },
  },
}));

vi.mock('../../../services/credit-service', () => ({
  deductCredits: vi.fn(async () => undefined),
  getBalance: vi.fn(async () => ({ credits: 0 })),
  hasCredits: vi.fn(async () => true),
}));

vi.mock('../../../services/ocr-extraction', () => ({
  extractInvoiceData: vi.fn(async () => ({})),
}));

vi.mock('../../../services/billing-webhook', () => ({
  handleStripeWebhook: vi.fn(async () => undefined),
}));

vi.mock('../../../services/bank-statement', () => ({
  parseBankStatement: vi.fn(() => []),
  matchStatementToRun: vi.fn(() => []),
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
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  getIdpAuditLogger: vi.fn(() => ({
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
  withBodyLogging: vi.fn((_o, fn) => fn),
  logIntegrationCall: vi.fn(),
  subscribeOpossumEvents: vi.fn(),
  runWithRequestContext: vi.fn((_c, fn) => fn()),
  getRequestId: vi.fn(() => undefined),
  getTraceparent: vi.fn(() => undefined),
  buildContextFromHeaders: vi.fn(() => ({})),
  getOutboundHeaders: vi.fn(() => ({})),
  generateRequestId: vi.fn(() => 'test-request-id'),
  logger: Object.assign(
    { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) },
  ),
  LOG_BODY_INCLUDE_PREFIXES: [],
  PII_MASK_KEYWORDS: [],
  PII_MASK_PATHS: [],
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// Payout-adapter value imports in the payment router — lockAndExport never uses
// them, so empty stubs satisfy the module graph without the live provider SDKs.
vi.mock('@contractor-ops/integrations', () => ({
  MockModernTreasuryAdapter: class {},
  StripeTreasuryAdapter: class {},
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory, router } from '../../../init';
import { encryptBankAccount } from '../../../services/bank-account-crypto';
import { paymentRouter } from '../payment';

// lockAndExport lives on the payment router; mounting just that router (rather
// than the full appRouter) keeps this a focused, self-contained caller.
const testRouter = router({ payment: paymentRouter });
const createCaller = createCallerFactory(testRouter);

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
// Fixture
// ---------------------------------------------------------------------------

/** A DRAFT USD run whose single item pays a US bank (encrypted US routing/account, no IBAN). */
function makeUsRun(amountMinor: number) {
  return {
    id: RUN_ID,
    organizationId: ORG_ID,
    runNumber: 'PR-2026-USD-001',
    status: 'DRAFT',
    currency: 'USD',
    totalMinor: amountMinor,
    invoiceCount: 1,
    items: [
      {
        id: ITEM_ID,
        contractorId: CONTRACTOR_ID,
        invoiceId: INVOICE_ID_1,
        amountMinor,
        currency: 'USD',
        invoice: {
          invoiceNumber: 'INV-US-001',
          dueDate: new Date('2026-06-01'),
          servicePeriodStart: null,
          servicePeriodEnd: null,
        },
        contractor: { legalName: 'US Payee LLC', taxId: '99-1234567', currency: 'USD' },
        billingProfile: {
          bankAccountMasked: '****4321',
          swiftBic: null,
          bankName: 'US Test Bank',
          usRoutingNumberEncrypted: encryptBankAccount(US_ROUTING),
          usAccountNumberEncrypted: encryptBankAccount(US_ACCOUNT),
        },
      },
    ],
  };
}

/** Org bank metadata carrying a structurally complete ACH origination block. */
const US_ORG_METADATA = JSON.stringify({
  settingsJson: {
    paymentTransferTitleTemplate: '{invoice_number}',
    bankAccount: { iban: 'PL00000000000000000000000000', bic: 'BREXPLPW' },
    achOrigin: {
      immediateDestination: '021000021',
      immediateOrigin: '1234567890',
      companyId: '1234567890',
      odfiRoutingPrefix: '02100002',
    },
  },
});

function seedUsRun(amountMinor: number) {
  const run = makeUsRun(amountMinor);
  mockPrisma.paymentRun.findFirst.mockResolvedValueOnce(run);
  mockPrisma.paymentRun.findFirstOrThrow.mockResolvedValueOnce({ ...run, status: 'EXPORTED' });
  mockPrisma.organization.findUnique.mockResolvedValue({
    name: 'US Test Org',
    metadata: US_ORG_METADATA,
  });
  return run;
}

// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockPrisma),
  );
  mockPrisma.paymentRun.findFirst.mockReset().mockResolvedValue(null);
  mockPrisma.paymentRunItem.findMany.mockReset().mockResolvedValue([]);
  mockPrisma.paymentRunItem.aggregate
    .mockReset()
    .mockResolvedValue({ _sum: { amountMinor: 0 }, _count: 0 });
  mockPrisma.member.findFirst.mockReset().mockResolvedValue({ role: 'admin' });
  mockPrisma.paymentRun.updateMany.mockReset().mockResolvedValue({ count: 1 });
});

describe('lockAndExport — US export end-to-end', () => {
  it('exports a NACHA .txt carrying the decrypted US routing/account for an ACH_NACHA lock (<= ceiling)', async () => {
    seedUsRun(50_000_00);

    const result = await caller.payment.lockAndExport({ runId: RUN_ID, exportFormat: 'ACH_NACHA' });

    expect(result.fileName).toMatch(/\.txt$/);
    const decoded = Buffer.from(result.fileBase64 ?? '', 'base64').toString('ascii');
    const detailRecords = decoded.split('\r\n').filter(line => line.startsWith('6'));
    expect(detailRecords.length).toBeGreaterThan(0);
    for (const record of detailRecords) {
      expect(record).toHaveLength(94);
    }
    // The decrypted US routing (first 8 digits) + account appear in the entry,
    // proving _buildExportItems populated ExportItem.usRoutingNumber/usAccountNumber
    // rather than falling back to the masked/empty account.
    expect(decoded).toContain('12345678');
    expect(decoded).toContain(US_ACCOUNT);
  });

  it('exports a Fedwire pacs.008 .xml for a FEDWIRE lock (> ceiling)', async () => {
    seedUsRun(2_000_000_00);

    const result = await caller.payment.lockAndExport({ runId: RUN_ID, exportFormat: 'FEDWIRE' });

    expect(result.fileName).toMatch(/\.xml$/);
    const decoded = Buffer.from(result.fileBase64 ?? '', 'base64').toString('utf-8');
    expect(decoded).toContain('pacs.008');
    expect(decoded).toContain('US Payee LLC');
  });
});

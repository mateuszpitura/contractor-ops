import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-pub-inv-001';
const OTHER_ORG_ID = 'org-pub-inv-other';
const INVOICE_ID = 'inv-pub-001';
const CONTRACTOR_ID = 'ctr-pub-001';
const KEY_ID = 'key-pub-inv-001';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockDb, mockResolveApiKey, mockTouchLastUsed, mockGetSubscription } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockDb: Rec = {
    invoice: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      count: vi.fn(async () => 0),
    },
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
  };

  return {
    mockDb,
    mockResolveApiKey: vi.fn(),
    mockTouchLastUsed: vi.fn(),
    mockGetSubscription: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: vi.fn(() => ({ enabled: true, reason: 'unleash' })),
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
    getSession: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockDb,
  prismaRaw: mockDb,
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockDb),
  createTenantClientFrom: vi.fn(() => mockDb),
  getRegionalClient: vi.fn(() => mockDb),
}));

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
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
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  LOG_BODY_INCLUDE_PREFIXES: [],
  PII_MASK_KEYWORDS: [],
  PII_MASK_PATHS: [],
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
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

vi.mock('../../../services/api-key-service', () => ({
  resolveApiKey: mockResolveApiKey,
  touchLastUsed: mockTouchLastUsed,
}));

vi.mock('../../../services/billing-service', () => ({
  getSubscription: mockGetSubscription,
}));

vi.mock('../../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {},
  CacheTTL: {},
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../../init';
import { publicInvoiceRouter } from '../invoice';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(publicInvoiceRouter);

function makeKeyRecord(overrides?: Record<string, unknown>) {
  return {
    id: KEY_ID,
    organizationId: ORG_ID,
    prefix: 'abcdefghijkl',
    hash: 'hashed',
    scopes: ['invoice:read'],
    revokedAt: null,
    expiresAt: null,
    lastUsedAt: null,
    organization: { id: ORG_ID, dataRegion: 'EU', status: 'ACTIVE' },
    ...overrides,
  };
}

function makeSubscription(tier = 'ENTERPRISE', status = 'ACTIVE') {
  return {
    id: 'sub_1',
    organizationId: ORG_ID,
    tier,
    status,
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_stripe_1',
    stripeSubscriptionItemId: 'si_1',
    seatCount: 1,
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2027-01-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeCaller(scopes = ['invoice:read']) {
  mockResolveApiKey.mockResolvedValue(makeKeyRecord({ scopes }));
  mockGetSubscription.mockResolvedValue(makeSubscription());
  return createCaller({
    headers: new Headers({ authorization: 'Bearer co_live_test_token' }),
    session: null,
    user: null,
  });
}

function makeInvoice(overrides?: Record<string, unknown>) {
  return {
    id: INVOICE_ID,
    invoiceNumber: 'INV-2026-001',
    issueDate: new Date('2026-01-15'),
    dueDate: new Date('2026-02-15'),
    servicePeriodStart: null,
    servicePeriodEnd: null,
    currency: 'EUR',
    subtotalMinor: 100000,
    vatRate: 23,
    vatAmountMinor: 23000,
    totalMinor: 123000,
    withholdingMinor: null,
    amountToPayMinor: 123000,
    sellerTaxId: 'PL1234567890',
    sellerName: 'Test Contractor Sp. z o.o.',
    sellerBankAccount: null,
    status: 'RECEIVED',
    matchStatus: 'UNMATCHED',
    source: 'MANUAL',
    isReverseCharge: false,
    contractorId: CONTRACTOR_ID,
    contractId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('publicInvoiceRouter', () => {
  describe('list', () => {
    it('returns paginated invoices scoped to the API key organization', async () => {
      const invoices = [
        makeInvoice(),
        makeInvoice({ id: 'inv-pub-002', invoiceNumber: 'INV-2026-002' }),
      ];
      mockDb.invoice.findMany.mockResolvedValueOnce(invoices);
      mockDb.invoice.count.mockResolvedValueOnce(2);

      const caller = makeCaller();
      const result = await caller.list({});

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBeUndefined();

      const whereArg = (mockDb.invoice.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ organizationId: ORG_ID, deletedAt: null });
    });

    it('filters by status when provided', async () => {
      mockDb.invoice.findMany.mockResolvedValueOnce([makeInvoice({ status: 'APPROVED' })]);

      const caller = makeCaller();
      await caller.list({ filter: { status: 'APPROVED' } });

      const whereArg = (mockDb.invoice.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ organizationId: ORG_ID, status: 'APPROVED' });
    });

    it('filters by contractorId when provided', async () => {
      mockDb.invoice.findMany.mockResolvedValueOnce([]);

      const caller = makeCaller();
      await caller.list({ filter: { contractorId: CONTRACTOR_ID } });

      const whereArg = (mockDb.invoice.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ organizationId: ORG_ID, contractorId: CONTRACTOR_ID });
    });

    it('never leaks soft-deleted invoices', async () => {
      mockDb.invoice.findMany.mockResolvedValueOnce([]);
      mockDb.invoice.count.mockResolvedValueOnce(0);

      const caller = makeCaller();
      await caller.list({});

      const whereArg = (mockDb.invoice.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ deletedAt: null });
    });

    it('response items do not include encrypted or internal fields', async () => {
      const invoices = [makeInvoice()];
      mockDb.invoice.findMany.mockResolvedValueOnce(invoices);
      mockDb.invoice.count.mockResolvedValueOnce(1);

      const caller = makeCaller();
      const result = await caller.list({});

      const item = result.items[0] as Record<string, unknown>;
      expect(item).not.toHaveProperty('deletedAt');
      expect(item).not.toHaveProperty('organizationId');
    });

    it('rejects caller with insufficient scope (missing invoice:read)', async () => {
      const caller = makeCaller([]);
      await expect(caller.list({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('getById', () => {
    it('returns invoice details when the id belongs to the API key org', async () => {
      const invoice = {
        ...makeInvoice(),
        contractor: {
          id: CONTRACTOR_ID,
          legalName: 'Test Contractor Sp. z o.o.',
          taxId: 'PL1234567890',
        },
        contract: null,
      };
      mockDb.invoice.findFirst.mockResolvedValueOnce(invoice);

      const caller = makeCaller();
      const result = await caller.getById({ id: INVOICE_ID });

      expect(result.id).toBe(INVOICE_ID);
      expect(result.invoiceNumber).toBe('INV-2026-001');

      const whereArg = (mockDb.invoice.findFirst as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ id: INVOICE_ID, organizationId: ORG_ID, deletedAt: null });
    });

    it('throws NOT_FOUND when invoice id belongs to a different organization', async () => {
      mockDb.invoice.findFirst.mockResolvedValueOnce(null);

      const caller = makeCaller();
      await expect(caller.getById({ id: 'inv-other-org' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'invoiceNotFound',
      });

      const whereArg = (mockDb.invoice.findFirst as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ organizationId: ORG_ID });
      expect(whereArg.organizationId).not.toBe(OTHER_ORG_ID);
    });

    it('throws NOT_FOUND when invoice does not exist at all', async () => {
      mockDb.invoice.findFirst.mockResolvedValueOnce(null);

      const caller = makeCaller();
      await expect(caller.getById({ id: 'nonexistent-id' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('response does not expose organizationId or deletedAt', async () => {
      const invoice = {
        ...makeInvoice(),
        contractor: null,
        contract: null,
      };
      mockDb.invoice.findFirst.mockResolvedValueOnce(invoice);

      const caller = makeCaller();
      const result = (await caller.getById({ id: INVOICE_ID })) as Record<string, unknown>;

      expect(result).not.toHaveProperty('organizationId');
      expect(result).not.toHaveProperty('deletedAt');
    });

    it('rejects caller with insufficient scope', async () => {
      const caller = makeCaller(['contract:read']);
      await expect(caller.getById({ id: INVOICE_ID })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });
});

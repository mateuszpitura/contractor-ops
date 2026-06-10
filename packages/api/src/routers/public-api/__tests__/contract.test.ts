import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-pub-ctr-001';
const OTHER_ORG_ID = 'org-pub-ctr-other';
const CONTRACT_ID = 'contract-pub-001';
const CONTRACTOR_ID = 'contractor-pub-001';
const KEY_ID = 'key-pub-ctr-001';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockDb, mockResolveApiKey, mockTouchLastUsed, mockGetSubscription } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockDb: Rec = {
    contract: {
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
  getIdpAuditLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() })),
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
  createLogger: vi.fn(() => ({ info: vi.fn(),
 warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
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
import { publicContractRouter } from '../contract';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(publicContractRouter);

function makeKeyRecord(overrides?: Record<string, unknown>) {
  return {
    id: KEY_ID,
    organizationId: ORG_ID,
    prefix: 'abcdefghijkl',
    hash: 'hashed',
    scopes: ['contract:read'],
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

function makeCaller(scopes = ['contract:read']) {
  mockResolveApiKey.mockResolvedValue(makeKeyRecord({ scopes }));
  mockGetSubscription.mockResolvedValue(makeSubscription());
  return createCaller({
    headers: new Headers({ authorization: 'Bearer co_live_test_token' }),
    session: null,
    user: null,
  });
}

function makeContract(overrides?: Record<string, unknown>) {
  return {
    id: CONTRACT_ID,
    title: 'Senior Backend Development',
    type: 'B2B',
    status: 'ACTIVE',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    noticePeriodDays: 30,
    autoRenewal: false,
    renewalTerms: null,
    currency: 'EUR',
    billingModel: 'TIME_AND_MATERIALS',
    rateType: 'HOURLY',
    rateValueMinor: 15000,
    retainerAmountMinor: null,
    expectedHoursPerPeriod: 160,
    paymentTermsDays: 30,
    invoiceCycle: 'MONTHLY',
    notes: null,
    contractorId: CONTRACTOR_ID,
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

describe('publicContractRouter', () => {
  describe('list', () => {
    it('returns paginated contracts scoped to the API key organization', async () => {
      const contracts = [
        makeContract(),
        makeContract({ id: 'contract-pub-002', title: 'QA Engineer Contract' }),
      ];
      mockDb.contract.findMany.mockResolvedValueOnce(contracts);
      mockDb.contract.count.mockResolvedValueOnce(2);

      const caller = makeCaller();
      const result = await caller.list({});

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(25);

      const whereArg = (mockDb.contract.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ organizationId: ORG_ID, deletedAt: null });
    });

    it('filters by status when provided', async () => {
      mockDb.contract.findMany.mockResolvedValueOnce([makeContract({ status: 'EXPIRED' })]);
      mockDb.contract.count.mockResolvedValueOnce(1);

      const caller = makeCaller();
      await caller.list({ status: 'EXPIRED' });

      const whereArg = (mockDb.contract.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ organizationId: ORG_ID, status: 'EXPIRED' });
    });

    it('filters by contractorId when provided', async () => {
      mockDb.contract.findMany.mockResolvedValueOnce([]);
      mockDb.contract.count.mockResolvedValueOnce(0);

      const caller = makeCaller();
      await caller.list({ contractorId: CONTRACTOR_ID });

      const whereArg = (mockDb.contract.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ organizationId: ORG_ID, contractorId: CONTRACTOR_ID });
    });

    it('excludes soft-deleted contracts from the result', async () => {
      mockDb.contract.findMany.mockResolvedValueOnce([]);
      mockDb.contract.count.mockResolvedValueOnce(0);

      const caller = makeCaller();
      await caller.list({});

      const whereArg = (mockDb.contract.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ deletedAt: null });
    });

    it('list response items do not include organizationId or deletedAt', async () => {
      const contracts = [makeContract()];
      mockDb.contract.findMany.mockResolvedValueOnce(contracts);
      mockDb.contract.count.mockResolvedValueOnce(1);

      const caller = makeCaller();
      const result = await caller.list({});

      const item = result.items[0] as Record<string, unknown>;
      expect(item).not.toHaveProperty('organizationId');
      expect(item).not.toHaveProperty('deletedAt');
    });

    it('rejects caller without contract:read scope', async () => {
      const caller = makeCaller([]);
      await expect(caller.list({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('rejects caller with unrelated scope only', async () => {
      const caller = makeCaller(['invoice:read']);
      await expect(caller.list({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('getById', () => {
    it('returns contract details when id belongs to the API key org', async () => {
      const contract = {
        ...makeContract(),
        contractor: { id: CONTRACTOR_ID, legalName: 'Test Corp', displayName: 'Test' },
      };
      mockDb.contract.findFirst.mockResolvedValueOnce(contract);

      const caller = makeCaller();
      const result = await caller.getById({ id: CONTRACT_ID });

      expect(result.id).toBe(CONTRACT_ID);
      expect(result.title).toBe('Senior Backend Development');

      const whereArg = (mockDb.contract.findFirst as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ id: CONTRACT_ID, organizationId: ORG_ID, deletedAt: null });
    });

    it('throws NOT_FOUND when the contract belongs to a different org', async () => {
      mockDb.contract.findFirst.mockResolvedValueOnce(null);

      const caller = makeCaller();
      await expect(caller.getById({ id: 'contract-other-org' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'contractNotFound',
      });

      const whereArg = (mockDb.contract.findFirst as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg.organizationId).toBe(ORG_ID);
      expect(whereArg.organizationId).not.toBe(OTHER_ORG_ID);
    });

    it('throws NOT_FOUND when contract id does not exist', async () => {
      mockDb.contract.findFirst.mockResolvedValueOnce(null);

      const caller = makeCaller();
      await expect(caller.getById({ id: 'nonexistent' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('response does not expose organizationId or deletedAt', async () => {
      const contract = {
        ...makeContract(),
        contractor: null,
      };
      mockDb.contract.findFirst.mockResolvedValueOnce(contract);

      const caller = makeCaller();
      const result = (await caller.getById({ id: CONTRACT_ID })) as Record<string, unknown>;

      expect(result).not.toHaveProperty('organizationId');
      expect(result).not.toHaveProperty('deletedAt');
    });

    it('rejects caller without contract:read scope', async () => {
      const caller = makeCaller(['contractor:read']);
      await expect(caller.getById({ id: CONTRACT_ID })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-pub-person-001';
const OTHER_ORG_ID = 'org-pub-person-other';
const CONTRACTOR_ID = 'person-pub-001';
const KEY_ID = 'key-pub-person-001';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockDb, mockResolveApiKey, mockTouchLastUsed, mockGetSubscription } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockDb: Rec = {
    contractor: {
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
  withRlsTransactions: <T,>(c: T) => c,
  prisma: mockDb,
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
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('../../../services/api-key-service.js', () => ({
  resolveApiKey: mockResolveApiKey,
  touchLastUsed: mockTouchLastUsed,
}));

vi.mock('../../../services/billing-service.js', () => ({
  getSubscription: mockGetSubscription,
}));

vi.mock('../../../services/cache.js', () => ({
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../../init.js';
import { publicContractorRouter } from '../contractor.js';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(publicContractorRouter);

function makeKeyRecord(overrides?: Record<string, unknown>) {
  return {
    id: KEY_ID,
    organizationId: ORG_ID,
    prefix: 'abcdefghijkl',
    hash: 'hashed',
    scopes: ['contractor:read'],
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

function makeCaller(scopes = ['contractor:read']) {
  mockResolveApiKey.mockResolvedValue(makeKeyRecord({ scopes }));
  mockGetSubscription.mockResolvedValue(makeSubscription());
  return createCaller({
    headers: new Headers({ authorization: 'Bearer co_live_test_token' }),
    session: null,
    user: null,
  });
}

function makeContractor(overrides?: Record<string, unknown>) {
  return {
    id: CONTRACTOR_ID,
    legalName: 'Kowalski Jan',
    displayName: 'Jan Kowalski',
    type: 'INDIVIDUAL',
    taxId: 'PL9876543210',
    vatId: null,
    registrationNumber: null,
    email: 'jan.kowalski@example.com',
    phone: '+48600100200',
    countryCode: 'PL',
    currency: 'PLN',
    addressLine1: 'ul. Kwiatowa 1',
    addressLine2: null,
    city: 'Warszawa',
    postalCode: '00-001',
    status: 'ACTIVE',
    lifecycleStage: 'ACTIVE',
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

describe('publicContractorRouter', () => {
  describe('list', () => {
    it('returns paginated contractors scoped to the API key organization', async () => {
      const contractors = [
        makeContractor(),
        makeContractor({ id: 'person-pub-002', legalName: 'Nowak Anna' }),
      ];
      mockDb.contractor.findMany.mockResolvedValueOnce(contractors);
      mockDb.contractor.count.mockResolvedValueOnce(2);

      const caller = makeCaller();
      const result = await caller.list({});

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(25);

      const whereArg = (mockDb.contractor.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ organizationId: ORG_ID, deletedAt: null });
    });

    it('filters by status when provided', async () => {
      mockDb.contractor.findMany.mockResolvedValueOnce([makeContractor({ status: 'INACTIVE' })]);
      mockDb.contractor.count.mockResolvedValueOnce(1);

      const caller = makeCaller();
      await caller.list({ status: 'INACTIVE' });

      const whereArg = (mockDb.contractor.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ organizationId: ORG_ID, status: 'INACTIVE' });
    });

    it('filters by lifecycleStage when provided', async () => {
      mockDb.contractor.findMany.mockResolvedValueOnce([]);
      mockDb.contractor.count.mockResolvedValueOnce(0);

      const caller = makeCaller();
      await caller.list({ lifecycleStage: 'ONBOARDING' });

      const whereArg = (mockDb.contractor.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ organizationId: ORG_ID, lifecycleStage: 'ONBOARDING' });
    });

    it('excludes soft-deleted contractors', async () => {
      mockDb.contractor.findMany.mockResolvedValueOnce([]);
      mockDb.contractor.count.mockResolvedValueOnce(0);

      const caller = makeCaller();
      await caller.list({});

      const whereArg = (mockDb.contractor.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ deletedAt: null });
    });

    it('list response items do not include organizationId or deletedAt', async () => {
      mockDb.contractor.findMany.mockResolvedValueOnce([makeContractor()]);
      mockDb.contractor.count.mockResolvedValueOnce(1);

      const caller = makeCaller();
      const result = await caller.list({});

      const item = result.items[0] as Record<string, unknown>;
      expect(item).not.toHaveProperty('organizationId');
      expect(item).not.toHaveProperty('deletedAt');
    });

    it('rejects caller without contractor:read scope', async () => {
      const caller = makeCaller([]);
      await expect(caller.list({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('rejects caller with only an unrelated scope', async () => {
      const caller = makeCaller(['invoice:read']);
      await expect(caller.list({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('getById', () => {
    it('returns contractor details when id belongs to the API key org', async () => {
      mockDb.contractor.findFirst.mockResolvedValueOnce(makeContractor());

      const caller = makeCaller();
      const result = await caller.getById({ id: CONTRACTOR_ID });

      expect(result.id).toBe(CONTRACTOR_ID);
      expect(result.legalName).toBe('Kowalski Jan');

      const whereArg = (mockDb.contractor.findFirst as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({
        id: CONTRACTOR_ID,
        organizationId: ORG_ID,
        deletedAt: null,
      });
    });

    it('throws NOT_FOUND when contractor belongs to a different org', async () => {
      mockDb.contractor.findFirst.mockResolvedValueOnce(null);

      const caller = makeCaller();
      await expect(caller.getById({ id: 'contractor-other-org' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'contractorNotFound',
      });

      const whereArg = (mockDb.contractor.findFirst as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg.organizationId).toBe(ORG_ID);
      expect(whereArg.organizationId).not.toBe(OTHER_ORG_ID);
    });

    it('throws NOT_FOUND when contractor id does not exist', async () => {
      mockDb.contractor.findFirst.mockResolvedValueOnce(null);

      const caller = makeCaller();
      await expect(caller.getById({ id: 'nonexistent' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('response does not expose organizationId or deletedAt', async () => {
      mockDb.contractor.findFirst.mockResolvedValueOnce(makeContractor());

      const caller = makeCaller();
      const result = (await caller.getById({ id: CONTRACTOR_ID })) as Record<string, unknown>;

      expect(result).not.toHaveProperty('organizationId');
      expect(result).not.toHaveProperty('deletedAt');
    });

    it('rejects caller without contractor:read scope', async () => {
      const caller = makeCaller(['contract:read']);
      await expect(caller.getById({ id: CONTRACTOR_ID })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });
  });
});

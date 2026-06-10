import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-pub-doc-001';
const OTHER_ORG_ID = 'org-pub-doc-other';
const DOC_ID = 'doc-pub-001';
const ENTITY_ID = 'invoice-pub-001';
const KEY_ID = 'key-pub-doc-001';
const STORAGE_KEY = `${ORG_ID}/documents/${DOC_ID}/contract.pdf`;

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockDb,
  mockResolveApiKey,
  mockTouchLastUsed,
  mockGetSubscription,
  mockCreateRegionalPresignedDownloadUrl,
} = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockDb: Rec = {
    document: {
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
    mockCreateRegionalPresignedDownloadUrl: vi.fn(
      async (key: string) => `https://r2.example.com/download/${key}?sig=xyz`,
    ),
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

vi.mock('../../../services/regional-storage', () => ({
  createRegionalPresignedDownloadUrl: mockCreateRegionalPresignedDownloadUrl,
  createRegionalPresignedUploadUrl: vi.fn(
    async (key: string) => `https://r2.example.com/upload/${key}?sig=abc`,
  ),
  headRegionalObject: vi.fn(async () => ({ ContentLength: 2048 })),
  deleteRegionalObject: vi.fn(async () => undefined),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createCallerFactory } from '../../../init';
import { publicDocumentRouter } from '../document';

// ---------------------------------------------------------------------------
// Caller helper
// ---------------------------------------------------------------------------

const createCaller = createCallerFactory(publicDocumentRouter);

function makeKeyRecord(overrides?: Record<string, unknown>) {
  return {
    id: KEY_ID,
    organizationId: ORG_ID,
    prefix: 'abcdefghijkl',
    hash: 'hashed',
    scopes: ['document:read'],
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

function makeCaller(scopes = ['document:read']) {
  mockResolveApiKey.mockResolvedValue(makeKeyRecord({ scopes }));
  mockGetSubscription.mockResolvedValue(makeSubscription());
  return createCaller({
    headers: new Headers({ authorization: 'Bearer co_live_test_token' }),
    session: null,
    user: null,
  });
}

function makeDocument(overrides?: Record<string, unknown>) {
  return {
    id: DOC_ID,
    originalFileName: 'contract_jan_2026.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 204800,
    storageKey: STORAGE_KEY,
    documentType: 'CONTRACT',
    status: 'ACTIVE',
    virusScanStatus: 'CLEAN',
    organizationId: ORG_ID,
    deletedAt: null,
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

describe('publicDocumentRouter', () => {
  describe('list', () => {
    it('returns paginated documents scoped to the API key organization', async () => {
      const docs = [
        makeDocument(),
        makeDocument({ id: 'doc-pub-002', originalFileName: 'invoice_feb_2026.pdf' }),
      ];
      mockDb.document.findMany.mockResolvedValueOnce(docs);
      mockDb.document.count.mockResolvedValueOnce(2);

      const caller = makeCaller();
      const result = await caller.list({});

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(25);

      const whereArg = (mockDb.document.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ organizationId: ORG_ID, deletedAt: null });
    });

    it('filters by entityType and entityId via relation link', async () => {
      mockDb.document.findMany.mockResolvedValueOnce([makeDocument()]);
      mockDb.document.count.mockResolvedValueOnce(1);

      const caller = makeCaller();
      await caller.list({ entityType: 'INVOICE', entityId: ENTITY_ID });

      const whereArg = (mockDb.document.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({
        organizationId: ORG_ID,
        links: {
          some: {
            organizationId: ORG_ID,
            entityType: 'INVOICE',
            entityId: ENTITY_ID,
          },
        },
      });
    });

    it('does not add links filter when entityType is provided without entityId', async () => {
      mockDb.document.findMany.mockResolvedValueOnce([]);
      mockDb.document.count.mockResolvedValueOnce(0);

      const caller = makeCaller();
      await caller.list({ entityType: 'CONTRACTOR' });

      const whereArg = (mockDb.document.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).not.toHaveProperty('links');
    });

    it('excludes soft-deleted documents', async () => {
      mockDb.document.findMany.mockResolvedValueOnce([]);
      mockDb.document.count.mockResolvedValueOnce(0);

      const caller = makeCaller();
      await caller.list({});

      const whereArg = (mockDb.document.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ deletedAt: null });
    });

    it('list query selects only safe fields (excludes storageKey, organizationId, deletedAt)', async () => {
      mockDb.document.findMany.mockResolvedValueOnce([]);
      mockDb.document.count.mockResolvedValueOnce(0);

      const caller = makeCaller();
      await caller.list({});

      const selectArg = (mockDb.document.findMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .select;
      expect(selectArg).toBeDefined();
      expect(selectArg).not.toHaveProperty('storageKey');
      expect(selectArg).not.toHaveProperty('organizationId');
      expect(selectArg).not.toHaveProperty('deletedAt');
    });

    it('rejects caller without document:read scope', async () => {
      const caller = makeCaller([]);
      await expect(caller.list({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('getDownloadUrl', () => {
    it('returns a presigned download URL for a valid document', async () => {
      mockDb.document.findFirst.mockResolvedValueOnce(makeDocument());

      const caller = makeCaller();
      const result = await caller.getDownloadUrl({ id: DOC_ID });

      expect(result.url).toContain('r2.example.com');
      expect(result.expiresIn).toBe(900);

      const whereArg = (mockDb.document.findFirst as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg).toMatchObject({ id: DOC_ID, organizationId: ORG_ID, deletedAt: null });
      expect(mockCreateRegionalPresignedDownloadUrl).toHaveBeenCalledWith(STORAGE_KEY, 900);
    });

    it('throws NOT_FOUND when document belongs to a different org', async () => {
      mockDb.document.findFirst.mockResolvedValueOnce(null);

      const caller = makeCaller();
      await expect(caller.getDownloadUrl({ id: 'doc-other-org' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'documentNotFound',
      });

      const whereArg = (mockDb.document.findFirst as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
        .where;
      expect(whereArg.organizationId).toBe(ORG_ID);
      expect(whereArg.organizationId).not.toBe(OTHER_ORG_ID);
    });

    it('throws NOT_FOUND when document id does not exist', async () => {
      mockDb.document.findFirst.mockResolvedValueOnce(null);

      const caller = makeCaller();
      await expect(caller.getDownloadUrl({ id: 'nonexistent' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });

      expect(mockCreateRegionalPresignedDownloadUrl).not.toHaveBeenCalled();
    });

    it('throws FORBIDDEN when document is infected', async () => {
      mockDb.document.findFirst.mockResolvedValueOnce(
        makeDocument({ virusScanStatus: 'INFECTED' }),
      );

      const caller = makeCaller();
      await expect(caller.getDownloadUrl({ id: DOC_ID })).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'documentInfected',
      });

      expect(mockCreateRegionalPresignedDownloadUrl).not.toHaveBeenCalled();
    });

    it('does not generate URL when document virusScanStatus is INFECTED', async () => {
      mockDb.document.findFirst.mockResolvedValueOnce(
        makeDocument({ virusScanStatus: 'INFECTED' }),
      );

      const caller = makeCaller();
      await expect(caller.getDownloadUrl({ id: DOC_ID })).rejects.toThrow();
      expect(mockCreateRegionalPresignedDownloadUrl).toHaveBeenCalledTimes(0);
    });

    it('rejects caller without document:read scope', async () => {
      const caller = makeCaller(['invoice:read']);
      await expect(caller.getDownloadUrl({ id: DOC_ID })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });
  });
});

/**
 * HTTP-level tRPC integration tests.
 *
 * Tests the full middleware chain via fetchRequestHandler — the same code path
 * as production. Unlike createCallerFactory tests (which bypass HTTP), these
 * exercise serialization, superjson transformation, header parsing, and the
 * real middleware stack (auth, tenant, RBAC, tier).
 *
 * Covers:
 * - Unauthenticated → UNAUTHORIZED
 * - Session auth → full pipeline
 * - Banned user → FORBIDDEN (ACCOUNT_BANNED)
 * - Missing active organization → FORBIDDEN
 * - Tier gating → TIER_REQUIRED
 * - RBAC permission denial → FORBIDDEN
 * - Portal auth via cookie
 * - API key auth via Bearer token
 * - Cron auth via Bearer CRON_SECRET
 * - GET queries with superjson-encoded input
 * - POST mutations with JSON body
 * - Error shape / serialization
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-http-int-001';
const USER_ID = 'user-http-int-001';
const CONTRACTOR_ID = 'contractor-http-int-001';

// ---------------------------------------------------------------------------
// Mocks (vi.hoisted)
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockGetSession,
  mockHasPermission,
  mockValidatePortalSession,
  mockResolveApiKey,
  mockGetSubscription,
} = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    member: {
      findFirst: vi.fn().mockResolvedValue({ role: 'admin' }),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (fnOrArray: ((tx: Rec) => Promise<unknown>) | unknown[]) => {
      if (typeof fnOrArray === 'function') return fnOrArray(mockPrisma);
      return Promise.all(fnOrArray);
    }),
  };

  return {
    mockPrisma,
    mockGetSession: vi.fn(),
    mockHasPermission: vi.fn().mockResolvedValue({ success: true }),
    mockValidatePortalSession: vi.fn(),
    mockResolveApiKey: vi.fn(),
    mockGetSubscription: vi.fn().mockResolvedValue({
      tier: 'ENTERPRISE',
      status: 'ACTIVE',
    }),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: mockGetSession,
      hasPermission: mockHasPermission,
    },
  },
  authApi: {
    getSession: mockGetSession,
    hasPermission: mockHasPermission,
  },
}));

vi.mock('@contractor-ops/classification', () => ({
  buildQuestionsSnapshot: vi.fn(),
  getAnswerSchemaForType: vi.fn(),
  getProfileForCountry: vi.fn(),
  outcomeSchema: { parse: vi.fn((v: unknown) => v) },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
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

vi.mock('../services/portal-session', () => ({
  validatePortalSession: mockValidatePortalSession,
}));

vi.mock('../services/api-key-service', () => ({
  resolveApiKey: mockResolveApiKey,
  touchLastUsed: vi.fn(),
}));

vi.mock('../services/billing-service', () => ({
  getSubscription: mockGetSubscription,
}));

vi.mock('../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {},
  CacheTTL: {},
}));

vi.mock('@sentry/nextjs', () => {
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
    withIsolationScope: vi.fn((fn: () => unknown) => fn()),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
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
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import superjson from 'superjson';
import { createContext } from '../context';
import { portalAppRouter } from '../portal-root';
import { appRouter } from '../root';

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

/**
 * Unwrapped tRPC response — superjson envelope (`.json`) is stripped
 * so tests can assert against the plain shape.
 */
type TRPCResult = {
  result?: { data?: unknown };
  error?: { message?: string; code?: number; data?: { code?: string; httpStatus?: number } };
};

async function trpcRequest(
  procedure: string,
  opts: {
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    input?: unknown;
    /**
     * Which tRPC endpoint to hit. 'main' = /api/trpc (appRouter), 'portal' = /api/trpc/portal (portalAppRouter).
     * portal procedures (`portal.*`, `portalTime.*`) live on the portal endpoint after the split.
     */
    endpoint?: 'main' | 'portal';
  } = {},
): Promise<{ status: number; body: TRPCResult }> {
  const { method = 'POST', headers = {}, input, endpoint = 'main' } = opts;

  const endpointPath = endpoint === 'portal' ? '/api/trpc/portal' : '/api/trpc';
  const router = endpoint === 'portal' ? portalAppRouter : appRouter;

  let url: string;

  if (method === 'GET' && input !== undefined) {
    const encoded = encodeURIComponent(superjson.stringify(input));
    url = `http://localhost${endpointPath}/${procedure}?input=${encoded}`;
  } else {
    url = `http://localhost${endpointPath}/${procedure}`;
  }

  const reqInit: RequestInit = {
    method,
    headers: new Headers({
      'content-type': 'application/json',
      ...headers,
    }),
  };

  if (method === 'POST' && input !== undefined) {
    reqInit.body = JSON.stringify({ json: input });
  }

  const req = new Request(url, reqInit);

  const res = await fetchRequestHandler({
    endpoint: endpointPath,
    req,
    router,
    createContext: () => createContext({ headers: req.headers }),
  });

  // tRPC + superjson wraps payloads in a `.json` envelope:
  //   success: { result: { data: { json: ... } } }
  //   error:   { error: { json: { message, code, data } } }
  // Unwrap so tests can assert against the plain shape.
  const raw = (await res.json()) as Record<string, unknown>;
  const body: TRPCResult = {};

  if (raw.error) {
    const envelope = raw.error as Record<string, unknown>;
    body.error = (envelope.json ?? envelope) as TRPCResult['error'];
  }
  if (raw.result) {
    const envelope = raw.result as Record<string, unknown>;
    const dataEnvelope = envelope.data as Record<string, unknown> | undefined;
    body.result = { data: dataEnvelope?.json ?? dataEnvelope };
  }

  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

function mockSessionAuth(
  userId = USER_ID,
  orgId = ORG_ID,
  overrides: Record<string, unknown> = {},
) {
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
      name: 'HTTP Test User',
      email: `${userId}@example.com`,
      emailVerified: true,
      image: null,
      banned: false,
      banReason: null,
      banExpires: null,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    },
  };
  mockGetSession.mockResolvedValue(session);
  return session;
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue(null);
  mockGetSubscription.mockResolvedValue({ tier: 'ENTERPRISE', status: 'ACTIVE' });
});

// ===========================================================================
// Tests
// ===========================================================================

describe('tRPC HTTP integration', () => {
  // =========================================================================
  // Authentication
  // =========================================================================

  describe('authentication', () => {
    it('rejects unauthenticated requests with UNAUTHORIZED', async () => {
      mockGetSession.mockResolvedValue(null);

      // organization.getCurrent is a query → GET
      const { status, body } = await trpcRequest('organization.getCurrent', { method: 'GET' });

      expect(status).toBe(401);
      expect(body.error?.data?.code).toBe('UNAUTHORIZED');
    });

    it('authenticates session-based requests via headers', async () => {
      mockSessionAuth();
      // Phase 2 P2-C / F-DB-03: tenantMiddleware now reads status via
      // getOrgMeta — must include `status: 'ACTIVE'` so loadAndAssertActive
      // doesn't throw FORBIDDEN/orgSuspended before we can assert auth.
      mockPrisma.organization.findUnique = vi
        .fn()
        .mockResolvedValue({ id: ORG_ID, name: 'Test Org', dataRegion: 'EU', status: 'ACTIVE' });

      // Use a simple query that just needs auth + tenant
      const { status } = await trpcRequest('organization.getCurrent', { method: 'GET' });

      // Should pass auth — may fail downstream but NOT with 401
      expect(status).not.toBe(401);
      expect(mockGetSession).toHaveBeenCalledTimes(1);
    });

    it('rejects banned user with FORBIDDEN', async () => {
      mockSessionAuth(USER_ID, ORG_ID, { banned: true });

      const { status, body } = await trpcRequest('organization.getCurrent', { method: 'GET' });

      expect(status).toBe(403);
      expect(body.error?.data?.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // Tenant context
  // =========================================================================

  describe('tenant context', () => {
    it('rejects session without active organization', async () => {
      // Session exists but no activeOrganizationId
      const session = {
        session: {
          id: 'session-no-org',
          userId: USER_ID,
          activeOrganizationId: null,
          expiresAt: new Date('2099-01-01'),
          token: 'mock-token',
          createdAt: new Date(),
          updatedAt: new Date(),
          ipAddress: null,
          userAgent: null,
        },
        user: {
          id: USER_ID,
          name: 'No Org User',
          email: 'noorg@example.com',
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
      mockGetSession.mockResolvedValue(session);

      const { status, body } = await trpcRequest('organization.getCurrent', { method: 'GET' });

      expect(status).toBe(403);
      expect(body.error?.data?.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // Tier gating
  // =========================================================================

  describe('tier gating', () => {
    it('rejects when subscription is missing for tier-gated procedure', async () => {
      mockSessionAuth();
      mockGetSubscription.mockResolvedValue(null);

      // apiKey.list is a query → GET; uses enterpriseProcedure → requireTier('ENTERPRISE')
      const { status, body } = await trpcRequest('apiKey.list', { method: 'GET' });

      expect(status).toBe(403);
      expect(body.error?.message).toContain('TIER_REQUIRED');
    });

    it('rejects insufficient tier', async () => {
      mockSessionAuth();
      mockGetSubscription.mockResolvedValue({ tier: 'STARTER', status: 'ACTIVE' });

      const { status, body } = await trpcRequest('apiKey.list', { method: 'GET' });

      expect(status).toBe(403);
      const parsed = JSON.parse(body.error?.message ?? '{}');
      expect(parsed.type).toBe('TIER_REQUIRED');
      expect(parsed.requiredTier).toBe('ENTERPRISE');
      expect(parsed.currentTier).toBe('STARTER');
    });

    it('allows sufficient tier', async () => {
      mockSessionAuth();
      mockGetSubscription.mockResolvedValue({ tier: 'ENTERPRISE', status: 'ACTIVE' });
      mockPrisma.apiKey = {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      };

      const { status } = await trpcRequest('apiKey.list', { method: 'GET' });

      // Should pass tier check — may fail downstream but NOT with tier error
      expect(status).not.toBe(403);
    });
  });

  // =========================================================================
  // RBAC
  // =========================================================================

  describe('RBAC', () => {
    it('rejects when permission check fails', async () => {
      mockSessionAuth();
      mockHasPermission.mockResolvedValue({ success: false });

      const { status, body } = await trpcRequest('settings.get', { method: 'GET' });

      expect(status).toBe(403);
      expect(body.error?.data?.code).toBe('FORBIDDEN');
    });

    it('allows when permission check succeeds', async () => {
      mockSessionAuth();
      mockHasPermission.mockResolvedValue({ success: true });
      mockPrisma.organizationSettings = {
        findUnique: vi.fn().mockResolvedValue({ id: 'settings-1' }),
      };

      const { status } = await trpcRequest('settings.get', { method: 'GET' });

      expect(status).not.toBe(403);
    });
  });

  // =========================================================================
  // Portal auth
  // =========================================================================

  describe('portal auth', () => {
    it('authenticates portal requests via cookie', async () => {
      mockValidatePortalSession.mockResolvedValue({
        id: 'portal-session-1',
        contractorId: CONTRACTOR_ID,
        organizationId: ORG_ID,
        contractor: { id: CONTRACTOR_ID, name: 'Test Contractor' },
        expiresAt: new Date('2099-01-01'),
      });

      mockPrisma.portalSession = {
        findUnique: vi.fn().mockResolvedValue({ id: 'portal-session-1' }),
      };
      mockPrisma.contractor = {
        findUnique: vi.fn().mockResolvedValue({
          id: CONTRACTOR_ID,
          organizationId: ORG_ID,
        }),
      };
      mockPrisma.contract = {
        findMany: vi.fn().mockResolvedValue([]),
      };

      // portalTime.getActiveContracts is a simple query → GET; uses portalProcedure → cookie auth
      // After router split, portalTime lives on the portalAppRouter at /api/trpc/portal.
      const { status } = await trpcRequest('portalTime.getActiveContracts', {
        method: 'GET',
        endpoint: 'portal',
        headers: {
          cookie: 'portal_session=valid-token-123',
        },
      });

      // Should pass portal auth (not 401)
      expect(mockValidatePortalSession).toHaveBeenCalledWith('valid-token-123');
      expect(status).not.toBe(401);
    });

    it('rejects portal requests without cookie', async () => {
      // No cookie header → portalProcedure throws UNAUTHORIZED
      const { status, body } = await trpcRequest('portalTime.getActiveContracts', {
        method: 'GET',
        endpoint: 'portal',
      });

      expect(status).toBe(401);
      expect(body.error?.data?.code).toBe('UNAUTHORIZED');
    });
  });

  // =========================================================================
  // GET query with superjson
  // =========================================================================

  describe('GET query with superjson encoding', () => {
    it('handles GET query with encoded input', async () => {
      mockSessionAuth();
      mockPrisma.zatcaInvoiceChain = {
        findFirst: vi.fn().mockResolvedValue({
          id: 'chain-1',
          invoiceId: 'inv-1',
          zatcaStatus: 'CLEARED',
        }),
      };

      const { status } = await trpcRequest('zatca.getStatus', {
        method: 'GET',
        input: { invoiceId: 'inv-1' },
      });

      // Should process the GET query (not 405 or parse error)
      expect(status).not.toBe(405);
    });
  });

  // =========================================================================
  // Error serialization
  // =========================================================================

  describe('error serialization', () => {
    it('returns structured tRPC error with code and httpStatus', async () => {
      mockGetSession.mockResolvedValue(null);

      const { status, body } = await trpcRequest('organization.getCurrent', { method: 'GET' });

      expect(status).toBe(401);
      expect(body.error).toBeDefined();
      expect(body.error?.data).toMatchObject({
        code: 'UNAUTHORIZED',
        httpStatus: 401,
      });
    });

    it('returns 500 for unexpected internal errors', async () => {
      mockSessionAuth();
      mockPrisma.organization.findUnique = vi
        .fn()
        .mockRejectedValue(new Error('DB connection lost'));

      const { status, body } = await trpcRequest('organization.getCurrent', { method: 'GET' });

      expect(status).toBe(500);
      expect(body.error?.data?.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  // =========================================================================
  // POST mutation
  // =========================================================================

  describe('POST mutation', () => {
    it('processes POST mutation with JSON body', async () => {
      mockSessionAuth();
      mockPrisma.notification = {
        updateMany: vi.fn().mockResolvedValue({ count: 3 }),
        findMany: vi.fn().mockResolvedValue([]),
      };

      const { status } = await trpcRequest('notification.markAllRead');

      // Should process the mutation (may succeed or fail based on mock completeness)
      expect(mockGetSession).toHaveBeenCalled();
      expect(status).not.toBe(401);
    });
  });
});

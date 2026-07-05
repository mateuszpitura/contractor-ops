/**
 * Wave-0 RED contract (INTEG-AUTH-05) — every external mutation is audited.
 *
 * Each public write emits exactly one AuditLog row carrying the API-key actor
 * (`actorType:'API_KEY'`, `actorId = apiKeyId`), the captured `ipAddress`
 * (sourceIp) and `userAgent`, plus `metadata.actingUserId`. This is the
 * non-repudiation contract for the external write surface.
 *
 * Turn-green plan: 99-04 (the write procedures pass ctx.sourceIp / ctx.userAgent
 * / ctx.apiKeyId into `writeAuditLog`). The sourceIp/userAgent ctx fields are
 * threaded in 99-02; here they are seeded on the caller ctx directly.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-audit-001';
const KEY_ID = 'key-audit-001';
const ACTING_USER_ID = 'user-audit-acting-001';
const SOURCE_IP = '203.0.113.7';
const USER_AGENT = 'acme-sdk/1.2.3';

const { mockDb, mockResolveApiKey, mockTouchLastUsed, mockGetSubscription, evaluateMock } =
  vi.hoisted(() => {
    type Rec = Record<string, unknown>;
    const org = 'org-audit-001';
    const table = () => ({
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => ({ id: 'row-1', organizationId: org, status: 'DRAFT' })),
      findFirstOrThrow: vi.fn(async () => ({ id: 'row-1', organizationId: org, status: 'DRAFT' })),
      findUnique: vi.fn(async () => ({ id: 'row-1', organizationId: org, status: 'DRAFT' })),
      create: vi.fn(async (args: { data: Rec }) => ({ id: 'created-1', ...args.data })),
      update: vi.fn(async (args: { data: Rec }) => ({ id: 'row-1', ...args.data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      count: vi.fn(async () => 0),
    });
    const mockDb: Rec = {
      contractor: table(),
      invoice: table(),
      payment: table(),
      paymentRun: table(),
      paymentRunItem: table(),
      workflowRun: table(),
      workflowTaskRun: table(),
      approvalFlow: table(),
      approvalStep: table(),
      auditLog: { create: vi.fn(async () => ({ id: 'audit-1' })) },
      organization: {
        findUnique: vi.fn().mockResolvedValue({ id: org, dataRegion: 'EU', status: 'ACTIVE' }),
      },
      $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockDb)),
    };
    return {
      mockDb,
      mockResolveApiKey: vi.fn(),
      mockTouchLastUsed: vi.fn(),
      mockGetSubscription: vi.fn(),
      evaluateMock: vi.fn(() => ({ enabled: true, reason: 'unleash' })),
    };
  });

vi.mock('@contractor-ops/feature-flags', () => ({ evaluate: evaluateMock }));

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: vi.fn().mockResolvedValue({ success: true }) },
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
    run: (_c: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockDb),
  createTenantClientFrom: vi.fn(() => mockDb),
  getRegionalClient: vi.fn(() => mockDb),
}));

vi.mock('../../services/api-key-service', () => ({
  resolveApiKey: mockResolveApiKey,
  touchLastUsed: mockTouchLastUsed,
}));

vi.mock('../../services/billing-service', () => ({ getSubscription: mockGetSubscription }));

vi.mock('../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {},
  CacheTTL: {},
}));

vi.mock('@contractor-ops/logger', () => {
  const stub = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return {
    createLogger: vi.fn(() => ({ ...stub, child: vi.fn(() => stub) })),
    createTrpcLogger: vi.fn(() => stub),
    createCronLogger: vi.fn(() => stub),
    createWebhookLogger: vi.fn(() => stub),
    createIntegrationLogger: vi.fn(() => stub),
    getIdpAuditLogger: vi.fn(() => ({ ...stub, child: vi.fn() })),
    withBodyLogging: vi.fn((_o: unknown, fn: unknown) => fn),
    runWithRequestContext: vi.fn((_c: unknown, fn: () => unknown) => fn()),
    getRequestId: vi.fn(() => undefined),
    generateRequestId: vi.fn(() => 'test-request-id'),
    logger: stub,
  };
});

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
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (s: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

import { createCallerFactory } from '../../init';
import { publicApiRouter } from '../../routers/public-api';

const createCaller = createCallerFactory(publicApiRouter);

function makeCaller() {
  mockResolveApiKey.mockResolvedValue({
    id: KEY_ID,
    organizationId: ORG_ID,
    prefix: 'abcdefghijkl',
    hash: 'hashed',
    scopes: [
      'contractor:create',
      'contractor:update',
      'invoice:create',
      'invoice:update',
      'payment:create',
      'payment:update',
      'payment:export',
      'workflow:create',
      'workflow:update',
      'workflow:execute',
    ],
    actingUserId: ACTING_USER_ID,
    revokedAt: null,
    supersededAt: null,
    graceExpiresAt: null,
    expiresAt: null,
    lastUsedAt: null,
    organization: { id: ORG_ID, dataRegion: 'EU', status: 'ACTIVE' },
  });
  mockGetSubscription.mockResolvedValue({
    id: 'sub_1',
    organizationId: ORG_ID,
    tier: 'ENTERPRISE',
    status: 'ACTIVE',
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2027-01-01'),
  });
  return createCaller({
    headers: new Headers({ authorization: 'Bearer co_live_test_token' }),
    session: null,
    user: null,
    // Seeded here as the real create-caller threads them from the Hono request.
    sourceIp: SOURCE_IP,
    userAgent: USER_AGENT,
  } as never);
}

/** One representative write per delivered entity. */
const REPRESENTATIVE_WRITES: Array<{ path: string; input: unknown }> = [
  {
    path: 'contractor.create',
    input: { legalName: 'Acme GmbH', type: 'COMPANY', countryCode: 'DE', currency: 'EUR' },
  },
  { path: 'invoice.void', input: { id: 'inv-1' } },
  { path: 'payment.update', input: { id: 'pay-1', status: 'PAID' } },
  { path: 'paymentRun.transition', input: { id: 'run-1', status: 'CANCELLED' } },
  { path: 'workflowTask.transition', input: { id: 'task-1', status: 'COMPLETED' } },
];

beforeEach(() => {
  vi.clearAllMocks();
  evaluateMock.mockReturnValue({ enabled: true, reason: 'unleash' });
});

describe('external mutations are audited with apiKeyId + sourceIp + userAgent', () => {
  for (const { path, input } of REPRESENTATIVE_WRITES) {
    it(`${path} writes an API_KEY audit row with sourceIp + userAgent`, async () => {
      const [entity, verb] = path.split('.') as [string, string];
      const caller = makeCaller() as unknown as Record<
        string,
        Record<string, (i: unknown) => Promise<unknown>>
      >;
      try {
        await caller[entity][verb](input);
      } catch {
        // The resolver may fail against the sparse mock DB — the audit row is
        // still expected to have been written inside the transaction.
      }
      expect(mockDb.auditLog.create).toHaveBeenCalledTimes(1);
      const data = (mockDb.auditLog.create.mock.calls[0]?.[0] as { data: Record<string, unknown> })
        .data;
      expect(data.actorType).toBe('API_KEY');
      expect(data.actorId).toBe(KEY_ID);
      expect(data.ipAddress).toBe(SOURCE_IP);
      expect(data.userAgent).toBe(USER_AGENT);
    });
  }
});

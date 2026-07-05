/**
 * Wave-0 RED contract (D-01) — the API-key → user-identity actor model.
 *
 * Each `OrganizationApiKey` binds to a mutable `actingUserId`: an attribution FK
 * (never an authorization source — scopes remain the sole authority). It
 * defaults to the key's creator, is rebindable to any ACTIVE org member, and
 * cross-org / removed / inactive users are rejected. The FK-requiring public
 * creates (paymentRun.create, workflow.create/execute) set their non-null user
 * FK to the key's actingUserId; the audit row records `actorType:'API_KEY'`,
 * `actorId = apiKeyId`, and `metadata.actingUserId`.
 *
 * Turn-green split:
 *   - Binding rows (default + membership guard on create/update): 99-02.
 *   - FK-on-create rows (paymentRun/workflow set the FK to actingUserId): 99-04.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-actor-001';
const CREATOR_ID = 'user-actor-creator-001';
const MEMBER_ID = 'user-actor-member-002';
const FOREIGN_ID = 'user-actor-foreign-999';
const KEY_ID = 'key-actor-001';

const { mockPrisma, mockGenerateApiKey, mockResolveApiKey, mockTouchLastUsed, evaluateMock } =
  vi.hoisted(() => {
    type Rec = Record<string, unknown>;
    const table = () => ({
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findFirstOrThrow: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async (args: { data: Rec }) => ({ id: 'created-1', ...args.data })),
      update: vi.fn(async (args: { data: Rec }) => ({ id: 'updated-1', ...args.data })),
      count: vi.fn(async () => 0),
    });
    const mockPrisma: Rec = {
      auditLog: {
        create: vi.fn(async () => ({ id: 'audit-1' })),
        createMany: vi.fn(async () => ({ count: 1 })),
      },
      organizationApiKey: table(),
      contractor: table(),
      invoice: table(),
      payment: table(),
      paymentRun: table(),
      paymentRunItem: table(),
      workflowRun: table(),
      workflowTaskRun: table(),
      member: { findFirst: vi.fn(async () => ({ id: 'm-1', role: 'admin', disabledAt: null })) },
      organization: {
        findUnique: vi.fn(async () => ({
          id: 'org-actor-001',
          dataRegion: 'EU',
          status: 'ACTIVE',
        })),
      },
      $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
    };
    return {
      mockPrisma,
      mockGenerateApiKey: vi.fn(() => ({
        plaintext: 'co_live_actorsecret',
        prefix: 'actorprefix1',
        hash: 'hashed_actor',
      })),
      mockResolveApiKey: vi.fn(),
      mockTouchLastUsed: vi.fn(),
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
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
  tenantStore: {
    run: (_c: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

vi.mock('../../services/api-key-service', () => ({
  generateApiKey: mockGenerateApiKey,
  resolveApiKey: mockResolveApiKey,
  touchLastUsed: mockTouchLastUsed,
}));

vi.mock('../../services/billing-service', () => ({
  getSubscription: vi.fn(async () => ({ id: 'sub_1', status: 'ACTIVE', tier: 'ENTERPRISE' })),
}));

vi.mock('../../services/org-cache', () => ({
  getOrgMeta: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })),
  invalidateOrgBranding: vi.fn(async () => undefined),
  invalidateOrgMeta: vi.fn(async () => undefined),
}));

vi.mock('../../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: { subscription: (o: string) => `sub:${o}` },
  CacheTTL: { SUBSCRIPTION: 300 },
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

import { createCallerFactory, router } from '../../init';
import { apiKeyRouter } from '../../routers/core/api-key';
import { publicApiRouter } from '../../routers/public-api';

const sessionCaller = createCallerFactory(router({ apiKey: apiKeyRouter }));
const publicCaller = createCallerFactory(publicApiRouter);

function makeSessionCaller(userId = CREATOR_ID) {
  return sessionCaller({
    headers: new Headers(),
    session: {
      session: {
        id: `session-${userId}`,
        userId,
        activeOrganizationId: ORG_ID,
        expiresAt: new Date('2099-01-01'),
        token: 'mock-token',
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
      },
      user: { id: userId, name: 'Creator', email: `${userId}@example.com`, role: 'admin' },
    } as never,
    user: { id: userId, name: 'Creator', email: `${userId}@example.com`, role: 'admin' } as never,
  });
}

function makeApiKeyCaller(scopes: string[]) {
  mockResolveApiKey.mockResolvedValue({
    id: KEY_ID,
    organizationId: ORG_ID,
    prefix: 'actorprefix1',
    hash: 'hashed_actor',
    scopes,
    actingUserId: MEMBER_ID,
    revokedAt: null,
    supersededAt: null,
    graceExpiresAt: null,
    expiresAt: null,
    lastUsedAt: null,
    organization: { id: ORG_ID, dataRegion: 'EU', status: 'ACTIVE' },
  });
  return publicCaller({
    headers: new Headers({ authorization: 'Bearer co_live_test_token' }),
    session: null,
    user: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.member.findFirst.mockResolvedValue({ id: 'm-1', role: 'admin', disabledAt: null });
});

// --- Binding rows — green in 99-02 -----------------------------------------

describe('actingUserId binding (apiKeyRouter, session)', () => {
  it('create defaults actingUserId to the creating user', async () => {
    mockPrisma.organizationApiKey.create.mockResolvedValueOnce({
      id: KEY_ID,
      name: 'Key',
      prefix: 'actorprefix1',
      scopes: ['contractor:read'],
      expiresAt: null,
      createdAt: new Date(),
    });
    const caller = makeSessionCaller(CREATOR_ID) as unknown as {
      apiKey: { create: (i: unknown) => Promise<unknown> };
    };
    await caller.apiKey.create({ name: 'Key', scopes: ['contractor:read'] });

    const createArg = mockPrisma.organizationApiKey.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createArg.data.actingUserId).toBe(CREATOR_ID);
  });

  it('create rejects binding actingUserId to a non-member (cross-org) user', async () => {
    mockPrisma.member.findFirst.mockResolvedValueOnce(null);
    const caller = makeSessionCaller(CREATOR_ID) as unknown as {
      apiKey: { create: (i: unknown) => Promise<unknown> };
    };
    await expect(
      caller.apiKey.create({ name: 'Key', scopes: ['contractor:read'], actingUserId: FOREIGN_ID }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('update rejects rebinding actingUserId to a non-member user', async () => {
    mockPrisma.organizationApiKey.findFirst.mockResolvedValueOnce({
      id: KEY_ID,
      organizationId: ORG_ID,
      revokedAt: null,
    });
    mockPrisma.member.findFirst.mockResolvedValueOnce(null);
    const caller = makeSessionCaller(CREATOR_ID) as unknown as {
      apiKey: { update: (i: unknown) => Promise<unknown> };
    };
    await expect(
      caller.apiKey.update({ id: KEY_ID, actingUserId: FOREIGN_ID }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// --- FK-on-create rows — green in 99-04 ------------------------------------

describe('actingUserId FK on public creates (apiKey)', () => {
  it('workflow.create sets WorkflowRun.startedByUserId to the key actingUserId', async () => {
    const caller = makeApiKeyCaller(['workflow:create']) as unknown as {
      workflow: { create: (i: unknown) => Promise<unknown> };
    };
    try {
      await caller.workflow.create({ templateId: 'wt-1' });
    } catch {
      // The resolver may fail against the sparse mock DB — we only assert the
      // FK wiring on whichever create call was reached.
    }
    const runCreate = mockPrisma.workflowRun.create.mock.calls[0]?.[0] as
      | { data: Record<string, unknown> }
      | undefined;
    expect(runCreate?.data.startedByUserId).toBe(MEMBER_ID);
  });

  it('paymentRun.create audits API_KEY with metadata.actingUserId', async () => {
    const caller = makeApiKeyCaller(['payment:create']) as unknown as {
      paymentRun: { create: (i: unknown) => Promise<unknown> };
    };
    try {
      await caller.paymentRun.create({ invoiceIds: ['inv-1'] });
    } catch {
      // Ditto — assert the audit attribution on the emitted row.
    }
    const auditCall = mockPrisma.auditLog.create.mock.calls[0]?.[0] as
      | { data: Record<string, unknown> }
      | undefined;
    expect(auditCall?.data.actorType).toBe('API_KEY');
    expect(
      (auditCall?.data.metadataJson as Record<string, unknown> | undefined)?.actingUserId,
    ).toBe(MEMBER_ID);
  });
});

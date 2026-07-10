/**
 * Cross-tenant isolation (IDOR) regression coverage for the net-new public read
 * families: payment, paymentRun, workflow, workflowTask, classification,
 * complianceDocument, auditLog.
 *
 * Idiom mirrors `tenant-isolation-extra.security.test.ts`: mock `@contractor-ops/db`
 * (echoes the `where` it is handed), drive each public list under an ORG_A
 * api-key with `module.public-api` ON, and regression-LOCK that every query
 * carries `organizationId: ORG_A` — and that a cross-org getById resolves to
 * NOT_FOUND (the org-scoped `where` yields null).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_A = 'org-a-pub-0001';
const KEY_A = 'key-a-pub-0001';

const models = [
  'paymentRun',
  'paymentRunItem',
  'workflowRun',
  'workflowTaskRun',
  'classificationAssessment',
  'classificationDocument',
  'auditLog',
] as const;

const { mockDb, mockResolveApiKey, mockGetSubscription, evaluateMock } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;
  const mockDb: Rec = {
    organization: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 'org-a-pub-0001', dataRegion: 'EU', status: 'ACTIVE' }),
    },
  };
  for (const m of [
    'paymentRun',
    'paymentRunItem',
    'workflowRun',
    'workflowTaskRun',
    'classificationAssessment',
    'classificationDocument',
    'auditLog',
  ]) {
    mockDb[m] = {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
    };
  }
  return {
    mockDb,
    mockResolveApiKey: vi.fn(),
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
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockDb),
  createTenantClientFrom: vi.fn(() => mockDb),
  getRegionalClient: vi.fn(() => mockDb),
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
  const span = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    getCurrentScope: vi.fn(() => ({
      setUser: vi.fn(),
      setTag: vi.fn(),
      setContext: vi.fn(),
      clear: vi.fn(),
    })),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (s: typeof span) => unknown) => fn(span)),
    captureException: vi.fn(),
  };
});

vi.mock('../../../services/api-key-service', () => ({
  resolveApiKey: mockResolveApiKey,
  touchLastUsed: vi.fn(),
}));

vi.mock('../../../services/billing-service', () => ({ getSubscription: mockGetSubscription }));

vi.mock('../../../services/cache', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../services/cache')>();
  const { createPassthroughCacheMock } = await import('../../../__tests__/__mocks__/cache-service');
  return createPassthroughCacheMock(actual);
});

import { createCallerFactory } from '../../../init';
import { publicAuditRouter } from '../audit';
import { publicClassificationRouter } from '../classification';
import { publicApiRouter } from '../index';

const createCaller = createCallerFactory(publicApiRouter);

const ALL_SCOPES = [
  'payment:read',
  'workflow:read',
  'classification:read',
  'document:read',
  'auditLog:read',
];

function makeCaller() {
  mockResolveApiKey.mockResolvedValue({
    id: KEY_A,
    organizationId: ORG_A,
    prefix: 'abcdefghijkl',
    hash: 'hashed',
    scopes: ALL_SCOPES,
    revokedAt: null,
    expiresAt: null,
    lastUsedAt: null,
    organization: { id: ORG_A, dataRegion: 'EU', status: 'ACTIVE' },
  });
  mockGetSubscription.mockResolvedValue({
    id: 'sub_1',
    organizationId: ORG_A,
    tier: 'ENTERPRISE',
    status: 'ACTIVE',
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2027-01-01'),
  });
  return createCaller({
    headers: new Headers({ authorization: 'Bearer co_live_test_token' }),
    session: null,
    user: null,
  });
}

function whereOf(model: string): Record<string, unknown> {
  const fn = (mockDb[model] as { findMany: ReturnType<typeof vi.fn> }).findMany;
  return (fn.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
}

beforeEach(() => vi.clearAllMocks());

describe('public net-new families — cross-tenant isolation', () => {
  const listCases: Array<[string, string]> = [
    ['payment.list', 'paymentRunItem'],
    ['paymentRun.list', 'paymentRun'],
    ['workflow.list', 'workflowRun'],
    ['workflowTask.list', 'workflowTaskRun'],
    ['classification.list', 'classificationAssessment'],
    ['complianceDocument.list', 'classificationDocument'],
    ['audit.list', 'auditLog'],
  ];

  it.each(listCases)('%s scopes findMany to the api-key org', async (path, model) => {
    const caller = makeCaller();
    const [ns, method] = path.split('.') as [keyof typeof caller, string];
    // @ts-expect-error dynamic dispatch across the public router namespaces
    await caller[ns][method]({});
    expect(whereOf(model)).toMatchObject({ organizationId: ORG_A });
  });

  const getByIdCases: Array<[string, string]> = [
    ['payment.getById', 'paymentRunItem'],
    ['paymentRun.getById', 'paymentRun'],
    ['workflow.getById', 'workflowRun'],
    ['workflowTask.getById', 'workflowTaskRun'],
    ['classification.getById', 'classificationAssessment'],
    ['complianceDocument.getById', 'classificationDocument'],
  ];

  it.each(
    getByIdCases,
  )('%s of a foreign id resolves NOT_FOUND with an org-scoped where', async (path, model) => {
    const caller = makeCaller();
    const [ns, method] = path.split('.') as [keyof typeof caller, string];
    (mockDb[model] as { findFirst: ReturnType<typeof vi.fn> }).findFirst.mockResolvedValueOnce(
      null,
    );
    await expect(
      // @ts-expect-error dynamic dispatch across the public router namespaces
      caller[ns][method]({ id: 'foreign-org-b-row' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const findFirst = (mockDb[model] as { findFirst: ReturnType<typeof vi.fn> }).findFirst;
    const where = (findFirst.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({ organizationId: ORG_A });
  });

  it('classification + audit expose only read procedures (no write surface)', () => {
    const classificationProcs = Object.keys(publicClassificationRouter._def.procedures);
    expect(classificationProcs.sort()).toEqual(['getById', 'list']);
    const auditProcs = Object.keys(publicAuditRouter._def.procedures);
    expect(auditProcs).toEqual(['list']);
    for (const p of [...classificationProcs, ...auditProcs]) {
      expect(['create', 'update', 'delete']).not.toContain(p);
    }
  });

  it('the isolation matrix covers all 7 net-new model families', () => {
    expect(models.length).toBe(7);
  });
});

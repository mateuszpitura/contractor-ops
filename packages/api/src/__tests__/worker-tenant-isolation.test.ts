/**
 * Worker cross-org leak test.
 *
 * The Worker base table (the normalized identity root for the worker-model
 * abstraction) is tenant-owning: it carries `organizationId` and is deliberately
 * absent from the `globalModels` set in `packages/db/src/tenant.ts`, so it
 * inherits the `withTenantScope` extension. This suite proves the invariant two
 * ways:
 *
 *   1. Structural — the raw `tenant.ts` source never lists `Worker` in
 *      `globalModels`, so org scope is injected on every Worker read.
 *   2. Behavioral — an ORG_A caller reading workers via the cross-type
 *      `worker.list` / `worker.getById` procedures only ever sees ORG_A rows;
 *      an ORG_B Worker is never returned to ORG_A.
 *
 * The worker surface ships behind `module.workforce-employees`, so the flag is
 * force-registered (QA_DEFAULT_ORG_ID) before `../root` is imported and the
 * feature-flag evaluator is stubbed enabled so the per-request guard passes.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Force-register the worker / employee namespaces into appRouter at import time.
// (isWorkforceRegistered() returns true when QA_DEFAULT_ORG_ID is set.)
process.env.QA_DEFAULT_ORG_ID = 'qa-worker-isolation-org';

const ORG_A_ID = 'org-a-00000000-0000-0000-0000-000000000001';
const ORG_B_ID = 'org-b-00000000-0000-0000-0000-000000000002';
const USER_A_ID = 'user-a-00000000-0000-0000-0000-000000000001';
const USER_B_ID = 'user-b-00000000-0000-0000-0000-000000000002';
const WORKER_A_ID = 'worker-a-001';
const WORKER_B_ID = 'worker-b-001';

const { mockPrisma } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const OrgA = 'org-a-00000000-0000-0000-0000-000000000001';
  const OrgB = 'org-b-00000000-0000-0000-0000-000000000002';

  const workerA: Rec = {
    id: 'worker-a-001',
    organizationId: OrgA,
    workerType: 'CONTRACTOR',
    displayName: 'Alpha Worker',
    email: 'alpha@example.com',
    status: 'ACTIVE',
    deletedAt: null,
    createdAt: new Date('2025-01-01'),
  };
  const employeeA: Rec = {
    id: 'worker-a-emp-001',
    organizationId: OrgA,
    workerType: 'EMPLOYEE',
    displayName: 'Alpha Employee',
    email: 'alpha.emp@example.com',
    status: 'ACTIVE',
    deletedAt: null,
    createdAt: new Date('2025-01-02'),
  };
  const workerB: Rec = {
    id: 'worker-b-001',
    organizationId: OrgB,
    workerType: 'CONTRACTOR',
    displayName: 'Beta Worker',
    email: 'beta@example.com',
    status: 'ACTIVE',
    deletedAt: null,
    createdAt: new Date('2025-02-01'),
  };

  const orgARecord: Rec = { id: OrgA, dataRegion: 'EU', status: 'ACTIVE', name: 'Org A' };
  const orgBRecord: Rec = { id: OrgB, dataRegion: 'EU', status: 'ACTIVE', name: 'Org B' };

  type OperatorCheck = (itemValue: unknown, operand: unknown) => boolean;
  const OperatorChecks: Record<string, OperatorCheck> = {
    in: (v, op) => Array.isArray(op) && op.includes(v),
    notIn: (v, op) => !(Array.isArray(op) && op.includes(v)),
    not: (v, op) => v !== op,
    equals: (v, op) => v === op,
  };

  function matchesOperator(itemValue: unknown, operator: Rec): boolean {
    for (const [op, operand] of Object.entries(operator)) {
      const check = OperatorChecks[op];
      if (check && !check(itemValue, operand)) return false;
    }
    return true;
  }

  function filterByWhere(collection: Rec[], where?: Rec): Rec[] {
    if (!where) return [...collection];
    return collection.filter(item => {
      for (const [key, value] of Object.entries(where)) {
        if (['OR', 'AND', 'NOT'].includes(key)) continue;
        if (key === 'deletedAt' && value === null) {
          if (item.deletedAt !== null) return false;
          continue;
        }
        if (typeof value === 'object' && value !== null) {
          if (!matchesOperator(item[key], value as Rec)) return false;
          continue;
        }
        if (item[key] !== value) return false;
      }
      return true;
    });
  }

  function model(collection: Rec[]) {
    return {
      findMany: vi.fn(async (opts?: { where?: Rec }) => filterByWhere(collection, opts?.where)),
      findFirst: vi.fn(async (opts?: { where?: Rec }) => {
        const results = filterByWhere(collection, opts?.where);
        return results[0] ?? null;
      }),
      findUnique: vi.fn(async (opts?: { where?: Rec }) => {
        const results = filterByWhere(collection, opts?.where);
        return results[0] ?? null;
      }),
      count: vi.fn(async (opts?: { where?: Rec }) => filterByWhere(collection, opts?.where).length),
    };
  }

  const mockPrisma: Rec = {
    organization: model([orgARecord, orgBRecord]),
    worker: model([workerA, employeeA, workerB]),
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma };
});

// Keep the real module (root.ts uses buildFlagBag at load) but force the
// workforce flag enabled so the per-request assertWorkforceEnabled guard passes.
vi.mock('@contractor-ops/feature-flags', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/feature-flags')>();
  return {
    ...actual,
    evaluate: vi.fn(() => ({ enabled: true, reason: 'enabled' })),
  };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue({ success: true }),
    },
  },
  authApi: {
    getSession: vi.fn(),
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
    getFullOrganization: vi.fn(),
  },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  withWorkerTypeDefault: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
  preWarmRegionalClients: vi.fn(),
}));

vi.mock('../services/cache', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/cache')>();
  const { createPassthroughCacheMock } = await import('../__tests__/__mocks__/cache-service');
  return createPassthroughCacheMock(actual);
});

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
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
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
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

import { createCallerFactory } from '../init';
import { appRouter } from '../root';

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
      name: `User ${userId}`,
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

const callerA = makeCaller(USER_A_ID, ORG_A_ID);
const callerB = makeCaller(USER_B_ID, ORG_B_ID);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Worker is tenant-owning (structural)', () => {
  it('Worker is NOT listed in the globalModels set in tenant.ts', () => {
    const tenantSource = readFileSync(
      fileURLToPath(new URL('../../../db/src/tenant.ts', import.meta.url)),
      'utf8',
    );
    const start = tenantSource.indexOf('const globalModels = new Set([');
    expect(start, 'globalModels set must exist in tenant.ts').toBeGreaterThanOrEqual(0);
    const end = tenantSource.indexOf(']);', start);
    const globalModelsBlock = tenantSource.slice(start, end);
    expect(globalModelsBlock).not.toContain("'Worker'");
    expect(globalModelsBlock).not.toContain('"Worker"');
  });
});

describe('Worker cross-org leak (behavioral)', () => {
  it('orgA worker.list returns only orgA workers (never an orgB row)', async () => {
    const result = await callerA.worker.list({});
    const ids = result.map(w => w.id);
    expect(ids).toContain(WORKER_A_ID);
    expect(ids).not.toContain(WORKER_B_ID);
  });

  it('orgB worker.list returns only orgB workers (never an orgA row)', async () => {
    const result = await callerB.worker.list({});
    const ids = result.map(w => w.id);
    expect(ids).toContain(WORKER_B_ID);
    expect(ids).not.toContain(WORKER_A_ID);
  });

  it('worker.list where clause always carries the caller organizationId', async () => {
    await callerA.worker.list({});
    const call = mockPrisma.worker.findMany.mock.calls[0]?.[0];
    expect(call?.where).toHaveProperty('organizationId', ORG_A_ID);
  });

  it('orgA worker.getById for an orgB worker returns null (no cross-org read)', async () => {
    const result = await callerA.worker.getById({ id: WORKER_B_ID });
    expect(result).toBeNull();
  });

  it('orgA worker.getById for its own worker returns the row', async () => {
    const result = await callerA.worker.getById({ id: WORKER_A_ID });
    expect(result?.id).toBe(WORKER_A_ID);
    expect(result?.organizationId ?? ORG_A_ID).toBe(ORG_A_ID);
  });

  it('concurrent callers keep independent worker tenant scoping', async () => {
    const [resultA, resultB] = await Promise.all([
      callerA.worker.list({}),
      callerB.worker.list({}),
    ]);
    const idsA = resultA.map(w => w.id);
    const idsB = resultB.map(w => w.id);
    expect(idsA).toContain(WORKER_A_ID);
    expect(idsA).not.toContain(WORKER_B_ID);
    expect(idsB).toContain(WORKER_B_ID);
    expect(idsB).not.toContain(WORKER_A_ID);
  });
});

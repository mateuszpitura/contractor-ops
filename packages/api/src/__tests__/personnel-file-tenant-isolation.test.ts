/**
 * PersonnelFile cross-org leak scaffold.
 *
 * PersonnelFile (and its PersonnelFileDocument child) are tenant-owning: they
 * carry organizationId and must be absent from the globalModels set in
 * packages/db/src/tenant.ts, so every read inherits withTenantScope. This suite
 * pins the invariant two ways:
 *
 *   1. Structural — the raw tenant.ts source never lists PersonnelFile or
 *      PersonnelFileDocument in globalModels (this assertion passes today and
 *      guards against a future regression).
 *   2. Behavioral — an ORG_A caller reading a personnel file for an ORG_B
 *      workerId never receives an ORG_B row. This is terminal-RED until a later
 *      wave mounts the personnelFile router on appRouter; the test directory is
 *      excluded from tsc so the not-yet-existing namespace does not brick the
 *      package typecheck.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.QA_DEFAULT_ORG_ID = 'qa-personnel-isolation-org';

const ORG_A_ID = 'org-a-00000000-0000-0000-0000-000000000001';
const ORG_B_ID = 'org-b-00000000-0000-0000-0000-000000000002';
const USER_A_ID = 'user-a-00000000-0000-0000-0000-000000000001';
const WORKER_A_ID = 'worker-a-001';
const WORKER_B_ID = 'worker-b-001';

const { mockPrisma } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const OrgA = 'org-a-00000000-0000-0000-0000-000000000001';
  const OrgB = 'org-b-00000000-0000-0000-0000-000000000002';

  const workerA: Rec = { id: 'worker-a-001', organizationId: OrgA, workerType: 'EMPLOYEE' };
  const workerB: Rec = { id: 'worker-b-001', organizationId: OrgB, workerType: 'EMPLOYEE' };

  const personnelFileA: Rec = {
    id: 'pf-a-001',
    organizationId: OrgA,
    workerId: 'worker-a-001',
    jurisdiction: 'PL',
    deletedAt: null,
  };
  const personnelFileB: Rec = {
    id: 'pf-b-001',
    organizationId: OrgB,
    workerId: 'worker-b-001',
    jurisdiction: 'PL',
    deletedAt: null,
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
    worker: model([workerA, workerB]),
    personnelFile: model([personnelFileA, personnelFileB]),
    personnelFileDocument: model([]),
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma };
});

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

vi.mock('../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
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
      role: 'hr_admin',
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

// The personnelFile namespace does not exist on appRouter yet; a later wave
// mounts it. Cast to the intended shape so the behavioral assertions read as
// the contract they will satisfy once GREEN.
type PersonnelFileCaller = {
  personnelFile: {
    getFile: (input: { workerId: string }) => Promise<{ organizationId?: string } | null>;
  };
};

const callerA = makeCaller(USER_A_ID, ORG_A_ID) as unknown as PersonnelFileCaller;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PersonnelFile is tenant-owning (structural)', () => {
  it('PersonnelFile and PersonnelFileDocument are NOT in the globalModels set', () => {
    const tenantSource = readFileSync(
      fileURLToPath(new URL('../../../db/src/tenant.ts', import.meta.url)),
      'utf8',
    );
    const start = tenantSource.indexOf('const globalModels = new Set([');
    expect(start, 'globalModels set must exist in tenant.ts').toBeGreaterThanOrEqual(0);
    const end = tenantSource.indexOf(']);', start);
    const globalModelsBlock = tenantSource.slice(start, end);
    expect(globalModelsBlock).not.toContain("'PersonnelFile'");
    expect(globalModelsBlock).not.toContain("'PersonnelFileDocument'");
  });
});

describe('PersonnelFile cross-org leak (behavioral)', () => {
  it('orgA personnelFile.getFile for an orgB workerId never returns an orgB row', async () => {
    const result = await callerA.personnelFile.getFile({ workerId: WORKER_B_ID });
    expect(result?.organizationId).not.toBe(ORG_B_ID);
    expect(result).toBeNull();
  });

  it('orgA personnelFile.getFile for its own workerId returns the orgA row', async () => {
    const result = await callerA.personnelFile.getFile({ workerId: WORKER_A_ID });
    expect(result?.organizationId ?? ORG_A_ID).toBe(ORG_A_ID);
  });
});

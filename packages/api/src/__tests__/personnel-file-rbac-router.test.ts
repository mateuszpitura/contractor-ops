/**
 * Per-section personnel-file RBAC — over-the-wire scaffold.
 *
 * The personnelFile.getFile procedure returns each section with a lock status
 * derived from the caller's per-section grants: a role only sees documents for
 * sections it may read, and a section it cannot read comes back
 * { status: 'locked' } with no documents array. This suite pins the
 * reviewer-verified matrix behaviorally:
 *   - payroll_officer  → section B locked (no documents array)
 *   - hr_admin         → section B unlocked (documents array present)
 *   - a caller with no employeeFile* grant → all four sections locked
 *
 * Terminal-RED until a later wave mounts the personnelFile router on appRouter;
 * the test directory is excluded from tsc so the not-yet-existing namespace
 * does not brick the package typecheck.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.QA_DEFAULT_ORG_ID = 'qa-personnel-rbac-org';

const ORG_ID = 'org-00000000-0000-0000-0000-000000000001';
const WORKER_ID = 'worker-emp-001';

const { mockPrisma } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const Org = 'org-00000000-0000-0000-0000-000000000001';
  const worker: Rec = { id: 'worker-emp-001', organizationId: Org, workerType: 'EMPLOYEE' };
  const orgRecord: Rec = { id: Org, dataRegion: 'EU', status: 'ACTIVE', name: 'Org' };
  const personnelFile: Rec = {
    id: 'pf-001',
    organizationId: Org,
    workerId: 'worker-emp-001',
    jurisdiction: 'PL',
    deletedAt: null,
  };

  function model(collection: Rec[]) {
    return {
      findMany: vi.fn(async () => collection),
      findFirst: vi.fn(async () => collection[0] ?? null),
      findUnique: vi.fn(async () => collection[0] ?? null),
      count: vi.fn(async () => collection.length),
    };
  }

  const mockPrisma: Rec = {
    organization: model([orgRecord]),
    worker: model([worker]),
    personnelFile: model([personnelFile]),
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

// Keep the real access-control `roles` matrix (the per-section grants under
// test) while stubbing the session/permission API surface. hasPermission is
// forced-true so the getFile procedure gate passes for every role — the
// per-section lock is decided by the real role statements, not this mock.
vi.mock('@contractor-ops/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/auth')>();
  return {
    ...actual,
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
  };
});

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
  getPersonnelRetentionCutoff: vi.fn(() => ({
    erasable: false,
    retainUntil: null,
    citation: null,
  })),
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

function makeCaller(role: string) {
  const userId = `user-${role}`;
  const session = {
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
    user: {
      id: userId,
      name: `User ${role}`,
      email: `${userId}@example.com`,
      emailVerified: true,
      image: null,
      banned: false,
      banReason: null,
      banExpires: null,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  return createCaller({
    headers: new Headers(),
    session: session as never,
    user: session.user as never,
  }) as unknown as PersonnelFileCaller;
}

type PersonnelFileSection = {
  id: string;
  status: 'locked' | 'unlocked';
  documents?: unknown[];
};
// The personnelFile namespace does not exist on appRouter yet; a later wave
// mounts it. Cast to the intended shape so the assertions read as the contract
// they will satisfy once GREEN.
type PersonnelFileCaller = {
  personnelFile: {
    getFile: (input: { workerId: string }) => Promise<{ sections: PersonnelFileSection[] }>;
  };
};

function sectionById(
  sections: PersonnelFileSection[],
  id: string,
): PersonnelFileSection | undefined {
  return sections.find(s => s.id === id);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('per-section RBAC over the wire — payroll_officer', () => {
  it('sees section B as locked with no documents array', async () => {
    const caller = makeCaller('payroll_officer');
    const file = await caller.personnelFile.getFile({ workerId: WORKER_ID });
    const sectionB = sectionById(file.sections, 'B');
    expect(sectionB?.status).toBe('locked');
    expect(sectionB?.documents).toBeUndefined();
  });
});

describe('per-section RBAC over the wire — hr_admin', () => {
  it('sees section B as unlocked with a documents array', async () => {
    const caller = makeCaller('hr_admin');
    const file = await caller.personnelFile.getFile({ workerId: WORKER_ID });
    const sectionB = sectionById(file.sections, 'B');
    expect(sectionB?.status).toBe('unlocked');
    expect(Array.isArray(sectionB?.documents)).toBe(true);
  });
});

describe('per-section RBAC over the wire — caller without employeeFile grants', () => {
  it('sees all four sections locked', async () => {
    const caller = makeCaller('owner');
    const file = await caller.personnelFile.getFile({ workerId: WORKER_ID });
    for (const id of ['A', 'B', 'C', 'D']) {
      expect(sectionById(file.sections, id)?.status).toBe('locked');
    }
  });
});

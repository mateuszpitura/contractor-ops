/**
 * Per-section RODO/GDPR erasure scaffold.
 *
 * Erasure honors deletion only past each section's retention window: a section
 * still inside a statutory window is retained and returned with its citation,
 * and the response NEVER claims full erasure while any hold is active. This
 * suite pins that legally-honest behavior before the procedure exists:
 *   - a partial hold → fullErasureClaimed false, per-section dispositions
 *     (erased vs retained-with-citation-and-retainUntil)
 *   - any active hold fires a writeAuditLog with action
 *     'personnel_file.erasure_retained_under_statute'
 *   - all sections past their window → fullErasureClaimed true
 *
 * Terminal-RED until a later wave adds the personnelFile.requestErasure
 * procedure; the test directory is excluded from tsc so the not-yet-existing
 * procedure does not brick the package typecheck.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.QA_DEFAULT_ORG_ID = 'qa-personnel-erasure-org';

const ORG_ID = 'org-00000000-0000-0000-0000-000000000001';
const WORKER_UNDER_HOLD = 'worker-hold-001';
const WORKER_FULLY_ERASABLE = 'worker-erasable-001';

const { mockPrisma, getPersonnelRetentionCutoff } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const Org = 'org-00000000-0000-0000-0000-000000000001';
  const orgRecord: Rec = { id: Org, dataRegion: 'EU', status: 'ACTIVE', name: 'Org' };
  const workerHold: Rec = { id: 'worker-hold-001', organizationId: Org, workerType: 'EMPLOYEE' };
  const workerErasable: Rec = {
    id: 'worker-erasable-001',
    organizationId: Org,
    workerType: 'EMPLOYEE',
  };

  // Both workers are US so their SECTION_A carries the two-anchor I-9 rule while
  // SECTION_B/C/D carry no federal window — the one jurisdiction that yields a
  // partial hold. Dates are anchored relative to "now" so the windows stay on the
  // intended side of today whenever the suite runs: the held worker's I-9 window
  // (max hire+3y, termination+1y) is still in the future; the erasable worker's
  // has long since passed.
  const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const personnelFiles: Rec[] = [
    {
      id: 'pf-hold',
      organizationId: Org,
      workerId: 'worker-hold-001',
      deletedAt: null,
      countryCode: 'US',
      hireDate: new Date(nowMs - 1 * YEAR_MS),
      terminatedAt: new Date(nowMs - 0.5 * YEAR_MS),
    },
    {
      id: 'pf-era',
      organizationId: Org,
      workerId: 'worker-erasable-001',
      deletedAt: null,
      countryCode: 'US',
      hireDate: new Date(nowMs - 16 * YEAR_MS),
      terminatedAt: new Date(nowMs - 15 * YEAR_MS),
    },
  ];

  function model(collection: Rec[]) {
    return {
      findMany: vi.fn(async () => collection),
      findFirst: vi.fn(async () => collection[0] ?? null),
      findUnique: vi.fn(async () => collection[0] ?? null),
      count: vi.fn(async () => collection.length),
      update: vi.fn(async (opts: { data?: Rec }) => opts.data ?? {}),
      updateMany: vi.fn(async () => ({ count: 0 })),
    };
  }

  // Dependency-free port of @contractor-ops/db's event-anchored retention
  // resolver. The pure resolver carries no Prisma import, but the db package is
  // fully mocked here (so a live client is never constructed); given the real
  // per-jurisdiction rules and the file's event dates it returns the real
  // per-section disposition, so the assertions exercise genuine retention math.
  const RETENTION_YEARS: Record<string, number> = {
    'pl-akta-post2019': 10,
    'pl-akta-legacy': 50,
    'de-personalakte-tax': 10,
    'de-accident-records': 30,
    'uk-personnel-general': 6,
    'uk-personnel-financial': 7,
    'us-i9-post-hire': 3,
    'us-i9-post-termination': 1,
  };
  type RuleInput = { recordType: string; anchor: string; citation: string; years?: number };
  type Dates = {
    hireDate: Date | null;
    terminationDate: Date | null;
    documentDate: Date | null;
    now: Date;
  };
  function anchorDateFor(anchor: string, dates: Dates): Date | null {
    if (anchor === 'HIRE_DATE') return dates.hireDate;
    if (anchor === 'TERMINATION_DATE') return dates.terminationDate;
    if (anchor === 'DOCUMENT_DATE') return dates.documentDate;
    return null;
  }
  function getPersonnelRetentionCutoff(rules: RuleInput[], dates: Dates) {
    if (!rules || rules.length === 0) {
      return { erasable: true, retainUntil: null, citation: null };
    }
    let binding: { retainUntil: Date; citation: string } | null = null;
    for (const rule of rules) {
      const anchorDate = anchorDateFor(rule.anchor, dates);
      if (anchorDate == null) {
        return { erasable: false, retainUntil: null, citation: rule.citation };
      }
      const years = RETENTION_YEARS[rule.recordType] ?? rule.years;
      if (years === undefined) {
        return { erasable: false, retainUntil: null, citation: rule.citation };
      }
      const retainUntil = new Date(anchorDate);
      retainUntil.setFullYear(retainUntil.getFullYear() + years);
      if (binding === null || retainUntil.getTime() > binding.retainUntil.getTime()) {
        binding = { retainUntil, citation: rule.citation };
      }
    }
    if (binding === null) {
      return { erasable: false, retainUntil: null, citation: null };
    }
    return {
      erasable: dates.now.getTime() >= binding.retainUntil.getTime(),
      retainUntil: binding.retainUntil,
      citation: binding.citation,
    };
  }

  const mockPrisma: Rec = {
    organization: model([orgRecord]),
    worker: model([workerHold, workerErasable]),
    personnelFile: {
      ...model(personnelFiles),
      // Resolve the file by the requested worker so the two fixtures do not
      // collapse onto one record (the generic findFirst ignores the where).
      findFirst: vi.fn(
        async (args: { where?: { workerId?: string } }) =>
          personnelFiles.find(f => f.workerId === args?.where?.workerId) ?? null,
      ),
    },
    personnelFileDocument: model([]),
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma, getPersonnelRetentionCutoff };
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
  getPersonnelRetentionCutoff,
}));

// Spy on the audit writer so the retained-under-statute audit call is asserted.
vi.mock('../services/audit-writer', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/audit-writer')>();
  return { ...actual, writeAuditLog: vi.fn(async () => undefined) };
});

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
import { writeAuditLog } from '../services/audit-writer';

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
  }) as unknown as PersonnelErasureCaller;
}

type ErasureSection = {
  section: 'A' | 'B' | 'C' | 'D';
  disposition: 'erased' | 'retained';
  citation?: string;
  retainUntil?: Date | string;
};
// The personnelFile namespace does not exist on appRouter yet; a later wave
// mounts it. Cast to the intended shape so the assertions read as the contract
// they will satisfy once GREEN.
type PersonnelErasureCaller = {
  personnelFile: {
    requestErasure: (input: {
      workerId: string;
    }) => Promise<{ fullErasureClaimed: boolean; sections: ErasureSection[] }>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('per-section erasure — partial statutory hold', () => {
  it('never claims full erasure while a section is retained, and cites the hold', async () => {
    const caller = makeCaller('hr_admin');
    const result = await caller.personnelFile.requestErasure({ workerId: WORKER_UNDER_HOLD });

    expect(result.fullErasureClaimed).toBe(false);

    const retained = result.sections.filter(s => s.disposition === 'retained');
    expect(retained.length).toBeGreaterThan(0);
    for (const section of retained) {
      expect(section.citation).toBeTruthy();
      expect(section.retainUntil).toBeTruthy();
    }
    expect(result.sections.some(s => s.disposition === 'erased')).toBe(true);
  });

  it('writes the retained-under-statute audit entry when a hold is active', async () => {
    const caller = makeCaller('hr_admin');
    await caller.personnelFile.requestErasure({ workerId: WORKER_UNDER_HOLD });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'personnel_file.erasure_retained_under_statute' }),
    );
  });
});

describe('per-section erasure — all sections past their window', () => {
  it('claims full erasure only when nothing is retained', async () => {
    const caller = makeCaller('hr_admin');
    const result = await caller.personnelFile.requestErasure({ workerId: WORKER_FULLY_ERASABLE });
    expect(result.fullErasureClaimed).toBe(true);
    expect(result.sections.every(s => s.disposition === 'erased')).toBe(true);
  });

  it('writes the erasure_requested audit entry on the fully-erased success path', async () => {
    const caller = makeCaller('hr_admin');
    await caller.personnelFile.requestErasure({ workerId: WORKER_FULLY_ERASABLE });

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'personnel_file.erasure_requested',
        resourceType: 'USER',
        resourceId: WORKER_FULLY_ERASABLE,
        metadata: expect.objectContaining({ fullErasureClaimed: true }),
      }),
    );
    // The success path carries no active hold, so the retained-under-statute
    // audit must NOT fire — only the erasure_requested row.
    expect(writeAuditLog).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'personnel_file.erasure_retained_under_statute' }),
    );
  });
});

describe('per-section erasure — every request is audited', () => {
  it('writes the erasure_requested audit entry even when a section is held', async () => {
    const caller = makeCaller('hr_admin');
    await caller.personnelFile.requestErasure({ workerId: WORKER_UNDER_HOLD });

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'personnel_file.erasure_requested',
        resourceType: 'USER',
        resourceId: WORKER_UNDER_HOLD,
        metadata: expect.objectContaining({ fullErasureClaimed: false }),
      }),
    );
  });
});

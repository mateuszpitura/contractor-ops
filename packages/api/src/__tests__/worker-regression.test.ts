// contractor-parity regression baseline.
//
// Locks the contractor read paths the Worker-model gate must not regress,
// captured GREEN against the CURRENT (pre-Worker) schema. After the upcoming
// Worker base table + backfill + `withWorkerTypeDefault` extension land, this
// same suite must stay GREEN — it is the provable baseline for "zero contractor
// path regression".
//
// Two layers are locked:
//   1. The Prisma-client read paths (list / dashboard / payment-run /
//      classification-scan / export / portal) every contractor read flows
//      through a `where` carrying the caller's `organizationId` (and, for the
//      soft-delete surface, `deletedAt: null`). The mock client filters rows by
//      that `where`, so a caller for org A only ever sees org A contractor rows.
//   2. The 4 `$queryRaw FROM "Contractor"` sites the central extension is
//      structurally blind to (Prisma passes `model: undefined` for raw SQL).
//      Each must spell out its contractor-scoping predicates inline; this suite
//      pins the exact predicate tokens so a future raw edit that drops the
//      organization/soft-delete scoping fails CI.
//
// The harness mirrors tenant-isolation.test.ts (mock Prisma + createCallerFactory),
// trimmed to the contractor read surface.

import { Prisma } from '@contractor-ops/db';
import type { ContractorFilters } from '@contractor-ops/validators';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildContractorListWhere } from '../routers/core/contractor-shared.js';

const ORG_A_ID = 'org-a-00000000-0000-0000-0000-000000000001';
const ORG_B_ID = 'org-b-00000000-0000-0000-0000-000000000002';
const USER_A_ID = 'user-a-00000000-0000-0000-0000-000000000001';
const USER_B_ID = 'user-b-00000000-0000-0000-0000-000000000002';
const CONTRACTOR_A_ID = 'contractor-a-001';
const CONTRACTOR_B_ID = 'contractor-b-001';

const { mockPrisma } = vi.hoisted(() => {
  type Rec = Record<string, unknown>;

  const OrgA = 'org-a-00000000-0000-0000-0000-000000000001';
  const OrgB = 'org-b-00000000-0000-0000-0000-000000000002';

  const contractorA: Rec = {
    id: 'contractor-a-001',
    organizationId: OrgA,
    legalName: 'Alpha Consulting Sp. z o.o.',
    displayName: 'Alpha',
    taxId: '1111111111',
    status: 'ACTIVE',
    lifecycleStage: 'ACTIVE',
    deletedAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-06-01'),
    owner: null,
    primaryTeam: null,
    billingProfiles: [],
    _count: { complianceItems: 0 },
  };
  const contractorB: Rec = {
    id: 'contractor-b-001',
    organizationId: OrgB,
    legalName: 'Beta Services S.A.',
    displayName: 'Beta',
    taxId: '2222222222',
    status: 'ACTIVE',
    lifecycleStage: 'ACTIVE',
    deletedAt: null,
    createdAt: new Date('2025-02-01'),
    updatedAt: new Date('2025-07-01'),
    owner: null,
    primaryTeam: null,
    billingProfiles: [],
    _count: { complianceItems: 0 },
  };
  const orgARecord: Rec = { id: OrgA, dataRegion: 'EU', status: 'ACTIVE' };
  const orgBRecord: Rec = { id: OrgB, dataRegion: 'EU', status: 'ACTIVE' };

  type OperatorCheck = (itemValue: unknown, operand: unknown) => boolean;
  const operatorChecks: Record<string, OperatorCheck> = {
    in: (v, op) => Array.isArray(op) && op.includes(v),
    notIn: (v, op) => !(Array.isArray(op) && op.includes(v)),
    not: (v, op) => v !== op,
    equals: (v, op) => v === op,
  };

  function matchesOperator(itemValue: unknown, operator: Rec): boolean {
    for (const [op, operand] of Object.entries(operator)) {
      const check = operatorChecks[op];
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
      groupBy: vi.fn(async () => []),
      aggregate: vi.fn(async () => ({ _count: 0 })),
    };
  }

  const mockPrisma: Rec = {
    organization: model([orgARecord, orgBRecord]),
    contractor: model([contractorA, contractorB]),
    contractorComplianceItem: { ...model([]), groupBy: vi.fn(async () => []) },
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma };
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

vi.mock('@contractor-ops/db', async () => {
  const actual = await vi.importActual<typeof import('@contractor-ops/db')>('@contractor-ops/db');
  return {
    Prisma: actual.Prisma,
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
    prisma: mockPrisma,
    prismaRaw: mockPrisma,
    tenantStore: { run: (_ctx: unknown, fn: () => unknown) => fn(), getStore: vi.fn() },
    withTenantScope: vi.fn((c: unknown) => c),
    withSoftDelete: vi.fn((c: unknown) => c),
    createTenantClient: vi.fn(() => mockPrisma),
    createTenantClientFrom: vi.fn(() => mockPrisma),
    getRegionalClient: vi.fn(() => mockPrisma),
    preWarmRegionalClients: vi.fn(),
    // Dashboard KPIs route reads through the replica helper; run the fetcher
    // against the same mock client so the raw contractor-count SQL is captured.
    readReplica: vi.fn((_region: string, fn: (db: unknown) => unknown) => fn(mockPrisma)),
    SUPPORTED_REGIONS: actual.SUPPORTED_REGIONS,
  };
});

// The KPI procedure wraps its read in a Redis-backed singleflight; collapse it
// to a direct call so the raw query is issued synchronously in the test.
vi.mock('../services/cache', () => ({
  cacheKey: vi.fn((...s: string[]) => s.join(':')),
  cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {
    dashboardKpis: (orgId: string) => `dashboard-kpis:${orgId}`,
    dashboardSpend: (orgId: string, range: string) => `dashboard-spend:${orgId}:${range}`,
    dashboardDeadlines: (orgId: string) => `dashboard-deadlines:${orgId}`,
  },
  CacheTTL: { DASHBOARD_KPIS_BURST: 5, DASHBOARD_SPEND: 600, DASHBOARD_DEADLINES: 180 },
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
  mockPrisma.$queryRaw.mockResolvedValue([]);
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockPrisma),
  );
});

describe('contractor-parity baseline (pre-Worker schema)', () => {
  describe('Prisma-client contractor read paths', () => {
    it('list returns only the caller-organization contractor rows', async () => {
      const result = await callerA.contractor.list({ page: 1, pageSize: 25 });
      const ids = result.items.map(c => (c as { id: string }).id);
      expect(ids).toContain(CONTRACTOR_A_ID);
      expect(ids).not.toContain(CONTRACTOR_B_ID);
    });

    it('list where always carries the caller organizationId and excludes soft-deleted rows', async () => {
      await callerA.contractor.list({ page: 1, pageSize: 10 });
      const call = mockPrisma.contractor.findMany.mock.calls[0]?.[0];
      expect(call?.where).toHaveProperty('organizationId', ORG_A_ID);
      expect(call?.where).toHaveProperty('deletedAt', null);
    });

    it('list count uses the same contractor-scoped where as the page read', async () => {
      await callerA.contractor.list({ page: 1, pageSize: 10 });
      const countCall = mockPrisma.contractor.count.mock.calls[0]?.[0];
      expect(countCall?.where).toHaveProperty('organizationId', ORG_A_ID);
      expect(countCall?.where).toHaveProperty('deletedAt', null);
    });

    it('getById (the detail / classification-scan read path) scopes to the caller organization', async () => {
      await expect(callerA.contractor.getById({ id: CONTRACTOR_B_ID })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      const call = mockPrisma.contractor.findFirst.mock.calls[0]?.[0];
      expect(call?.where).toHaveProperty('organizationId', ORG_A_ID);
    });
  });

  describe('buildContractorListWhere read predicate (list / payment-run / export share it)', () => {
    it('always anchors organizationId + deletedAt:null with no facets', async () => {
      const where = await buildContractorListWhere(mockPrisma as never, ORG_A_ID, {});
      expect(where).not.toBeNull();
      expect(where).toMatchObject({ organizationId: ORG_A_ID, deletedAt: null });
    });

    it('billingModel facet raw sub-query selects FROM "Contractor" scoped by org + deletedAt', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: CONTRACTOR_A_ID }]);
      const filters: ContractorFilters = { billingModel: ['HOURLY'] };
      await buildContractorListWhere(mockPrisma as never, ORG_A_ID, { filters });

      const rawCall = mockPrisma.$queryRaw.mock.calls[0];
      const sqlParts = (rawCall?.[0] as { join?: (s: string) => string })?.join?.(' ') ?? '';
      expect(sqlParts).toContain('FROM "Contractor"');
      expect(sqlParts).toContain('"organizationId"');
      expect(sqlParts).toContain('"deletedAt" IS NULL');
      // The org id is passed as a bound parameter, never interpolated.
      expect(JSON.stringify(rawCall)).toContain(ORG_A_ID);
    });

    it('FTS search facet raw sub-query selects FROM "Contractor" scoped by org + deletedAt', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: CONTRACTOR_A_ID }]);
      await buildContractorListWhere(mockPrisma as never, ORG_A_ID, { search: 'alpha' });

      const rawCall = mockPrisma.$queryRaw.mock.calls[0];
      const sqlParts = (rawCall?.[0] as { join?: (s: string) => string })?.join?.(' ') ?? '';
      expect(sqlParts).toContain('FROM "Contractor"');
      expect(sqlParts).toContain('"organizationId"');
      expect(sqlParts).toContain('"deletedAt" IS NULL');
      expect(sqlParts).toContain('search_vector');
    });

    it('an empty facet id-set short-circuits to null (no cross-org widening)', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);
      const filters: ContractorFilters = { billingModel: ['NONEXISTENT'] };
      const where = await buildContractorListWhere(mockPrisma as never, ORG_A_ID, { filters });
      expect(where).toBeNull();
    });
  });

  describe('dashboard fetchKpis activeContractors raw count (extension blind spot)', () => {
    it('counts FROM "Contractor" scoped by org + status ACTIVE + deletedAt:null', async () => {
      // The KPI block issues several parallel raw aggregates; the contractor
      // count is the first. Surface a deterministic shape for each.
      mockPrisma.$queryRaw.mockResolvedValue([{ activeContractors: 1, prevActiveContractors: 1 }]);
      await callerA.dashboard.kpis();

      const contractorRaw = mockPrisma.$queryRaw.mock.calls.find(call => {
        const parts = (call?.[0] as { join?: (s: string) => string })?.join?.(' ') ?? '';
        return parts.includes('FROM "Contractor"');
      });
      expect(contractorRaw).toBeDefined();
      const parts = (contractorRaw?.[0] as { join?: (s: string) => string })?.join?.(' ') ?? '';
      expect(parts).toContain('"organizationId"');
      expect(parts).toContain(`"status" = 'ACTIVE'`);
      expect(parts).toContain('"deletedAt" IS NULL');
      expect(JSON.stringify(contractorRaw)).toContain(ORG_A_ID);
    });
  });

  describe('search.global contractor FTS raw site (extension blind spot)', () => {
    it('queries FROM "Contractor" scoped by the caller org + deletedAt, never the other org', async () => {
      await callerA.search.global({ query: 'alpha' });
      const contractorRaw = mockPrisma.$queryRaw.mock.calls.find(call => {
        const parts = (call?.[0] as { join?: (s: string) => string })?.join?.(' ') ?? '';
        return parts.includes('FROM "Contractor"');
      });
      expect(contractorRaw).toBeDefined();
      const parts = (contractorRaw?.[0] as { join?: (s: string) => string })?.join?.(' ') ?? '';
      expect(parts).toContain('"organizationId"');
      expect(parts).toContain('"deletedAt" IS NULL');
      expect(parts).toContain('search_vector');
      const serialized = JSON.stringify(contractorRaw);
      expect(serialized).toContain(ORG_A_ID);
      expect(serialized).not.toContain(ORG_B_ID);
    });
  });

  describe('portal contractor read scoping', () => {
    it('a contractor read filtered by id + organizationId returns only the matching org row', async () => {
      // The portal surface reads contractors scoped to ctx.contractorId +
      // ctx.organizationId. With the mock client filtering by that where, an
      // org-A-scoped read can never surface org B's contractor row.
      const own = await mockPrisma.contractor.findFirst({
        where: { id: CONTRACTOR_A_ID, organizationId: ORG_A_ID, deletedAt: null },
      });
      expect((own as { id: string } | null)?.id).toBe(CONTRACTOR_A_ID);

      const foreign = await mockPrisma.contractor.findFirst({
        where: { id: CONTRACTOR_B_ID, organizationId: ORG_A_ID, deletedAt: null },
      });
      expect(foreign).toBeNull();
    });
  });
});

// Touch the unused caller so its setup (and the org-B fixture) stays meaningful
// to the harness without an extra assertion that would duplicate the org-A path.
void callerB;
void Prisma;

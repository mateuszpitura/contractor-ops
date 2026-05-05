/**
 * Leitweg-ID router tests — Phase 61 · Plan 61-04 Task 2.
 *
 * Strategy:
 *  - Mock @contractor-ops/db with a vi.hoisted mockPrisma modelling the
 *    LeitwegId table as an in-memory Map. All queries respect the
 *    `organizationId` in `where` so cross-tenant isolation is genuinely
 *    exercised (not stubbed).
 *  - Mock @contractor-ops/auth so we can flip hasPermission per test (RBAC
 *    test #11).
 *  - Drive the router through `createCallerFactory` + `makeCaller({ orgId })`
 *    so multi-tenant tests can pass orgA and orgB through the same appRouter.
 *
 * Tests (11):
 *  1. create — happy path
 *  2. create — invalid check digit (Zod rejects → BAD_REQUEST)
 *  3. create — duplicate value in same org → CONFLICT
 *  4. create — same value in different orgs is allowed
 *  5. create — isDefaultForContractor=true flips other rows
 *  6. update — cross-tenant id → NOT_FOUND (never leaks via FORBIDDEN)
 *  7. setDefault — atomically flips; only one default per contractor
 *  8. delete — cross-tenant id → NOT_FOUND
 *  9. delete — happy path
 *  10. list — returns only caller-org rows
 *  11. rbac — user without contractor:update permission → FORBIDDEN
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const ORG_B = 'clorgbbbbbbbbbbbbbbbbbbbbbb';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const CONTRACTOR_K1 = 'clcontractorK1aaaaaaaaaaaaa';
const CONTRACTOR_K2 = 'clcontractorK2aaaaaaaaaaaaa';

// Valid Leitweg-IDs — fixtures round-tripped through computeLeitwegCheckDigit
// against the Plan 01 ground-truth corpus.
const VALID_LWID_1 = '991-12345-06';
const VALID_LWID_2 = '99133333-TEST-07';
const VALID_LWID_3 = '12-ABCDE-02';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

interface LeitwegIdRow {
  id: string;
  organizationId: string;
  value: string;
  description: string | null;
  contractorId: string | null;
  contractId: string | null;
  isDefaultForContractor: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const { mockPrisma, leitwegIds, permissionResult } = vi.hoisted(() => {
  const leitwegIds = new Map<string, LeitwegIdRow>();
  const permissionResult = { success: true };

  let idCounter = 0;
  const nextId = () => `cllwid${(idCounter++).toString().padStart(20, '0')}`;

  const matches = (row: LeitwegIdRow, where: Record<string, unknown>): boolean => {
    for (const [key, val] of Object.entries(where)) {
      if (key === 'NOT') {
        const not = val as Record<string, unknown>;
        if (matches(row, not)) return false;
        continue;
      }
      if (val === null || typeof val !== 'object') {
        if ((row as unknown as Record<string, unknown>)[key] !== val) return false;
      } else {
        // nested relation filter — not used by these tests
      }
    }
    return true;
  };

  const mockPrisma: Record<string, unknown> = {
    organization: {
      findUnique: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })),
    },
    leitwegId: {
      findFirst: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        for (const row of leitwegIds.values()) {
          if (matches(row, where)) return row;
        }
        return null;
      }),
      findMany: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        return Array.from(leitwegIds.values()).filter(r => matches(r, where));
      }),
      create: vi.fn(async (args: { data: Partial<LeitwegIdRow> }) => {
        const id = nextId();
        const now = new Date();
        const existing = Array.from(leitwegIds.values()).find(
          r => r.organizationId === args.data.organizationId && r.value === args.data.value,
        );
        if (existing) {
          const err = new Error('Unique constraint failed');
          (err as unknown as { code: string }).code = 'P2002';
          throw err;
        }
        const row: LeitwegIdRow = {
          id,
          organizationId: args.data.organizationId ?? '',
          value: args.data.value ?? '',
          description: args.data.description ?? null,
          contractorId: args.data.contractorId ?? null,
          contractId: args.data.contractId ?? null,
          isDefaultForContractor: args.data.isDefaultForContractor ?? false,
          validFrom: args.data.validFrom ?? null,
          validTo: args.data.validTo ?? null,
          notes: args.data.notes ?? null,
          createdAt: now,
          updatedAt: now,
        };
        leitwegIds.set(id, row);
        return row;
      }),
      update: vi.fn(async (args: { where: { id: string }; data: Partial<LeitwegIdRow> }) => {
        const row = leitwegIds.get(args.where.id);
        if (!row) throw new Error('Row not found');
        const next = { ...row, ...args.data, updatedAt: new Date() };
        leitwegIds.set(row.id, next);
        return next;
      }),
      updateMany: vi.fn(
        async (args: { where: Record<string, unknown>; data: Partial<LeitwegIdRow> }) => {
          let count = 0;
          for (const row of leitwegIds.values()) {
            if (matches(row, args.where)) {
              leitwegIds.set(row.id, { ...row, ...args.data, updatedAt: new Date() });
              count++;
            }
          }
          return { count };
        },
      ),
      delete: vi.fn(async (args: { where: { id: string } }) => {
        const row = leitwegIds.get(args.where.id);
        if (!row) throw new Error('Row not found');
        leitwegIds.delete(row.id);
        return row;
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
  };

  return { mockPrisma, leitwegIds, permissionResult };
});

// ---------------------------------------------------------------------------
// Module mocks (must precede imports)
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn().mockImplementation(async () => permissionResult),
    },
  },
  authApi: {
    hasPermission: vi.fn().mockImplementation(async () => permissionResult),
  },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T,>(c: T) => c,
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

vi.hoisted(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

vi.mock('@sentry/nextjs', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    getCurrentScope: vi.fn(() => ({ setUser: vi.fn(), setTag: vi.fn(), setTags: vi.fn(), setContext: vi.fn(), setExtra: vi.fn(), clear: vi.fn() })),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(), trace: vi.fn(), child: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createIntegrationLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
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
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { authApi } from '@contractor-ops/auth';
import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';

const createCaller = createCallerFactory(appRouter);

function makeCaller(orgId = ORG_A, userId = USER_ID, role = 'admin') {
  const session = {
    session: {
      id: `session-${userId}-${orgId}`,
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
      name: 'Test User',
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
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  leitwegIds.clear();
  permissionResult.success = true;
  vi.mocked(authApi.hasPermission).mockImplementation(async () => permissionResult as never);
});

// ===========================================================================
// Tests
// ===========================================================================

describe('leitwegId.create', () => {
  it('creates a row for the caller organization (happy path)', async () => {
    const caller = makeCaller(ORG_A);
    const result = await caller.leitwegId.create({
      value: VALID_LWID_1,
      contractorId: CONTRACTOR_K1,
      isDefaultForContractor: false,
    });
    expect(result.value).toBe(VALID_LWID_1);
    expect(result.id).toMatch(/^cllwid/);
    const stored = Array.from(leitwegIds.values()).find(r => r.value === VALID_LWID_1);
    expect(stored?.organizationId).toBe(ORG_A);
  });

  it('rejects an invalid check digit at the Zod boundary (BAD_REQUEST)', async () => {
    const caller = makeCaller(ORG_A);
    // 991-12345-99 — structure is valid but the check digit is wrong.
    await expect(
      caller.leitwegId.create({
        value: '991-12345-99',
        isDefaultForContractor: false,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    // Zod rejection must happen before any DB insert.
    expect(Array.from(leitwegIds.values())).toHaveLength(0);
  });

  it('rejects a duplicate (organizationId, value) with CONFLICT', async () => {
    const caller = makeCaller(ORG_A);
    await caller.leitwegId.create({ value: VALID_LWID_1, isDefaultForContractor: false });
    await expect(
      caller.leitwegId.create({ value: VALID_LWID_1, isDefaultForContractor: false }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('allows the same value in different organizations', async () => {
    await makeCaller(ORG_A).leitwegId.create({
      value: VALID_LWID_1,
      isDefaultForContractor: false,
    });
    await makeCaller(ORG_B).leitwegId.create({
      value: VALID_LWID_1,
      isDefaultForContractor: false,
    });
    const byOrgA = Array.from(leitwegIds.values()).filter(r => r.organizationId === ORG_A);
    const byOrgB = Array.from(leitwegIds.values()).filter(r => r.organizationId === ORG_B);
    expect(byOrgA).toHaveLength(1);
    expect(byOrgB).toHaveLength(1);
  });

  it('flips other contractor-default rows to false when creating a new default', async () => {
    const caller = makeCaller(ORG_A);
    const first = await caller.leitwegId.create({
      value: VALID_LWID_1,
      contractorId: CONTRACTOR_K1,
      isDefaultForContractor: true,
    });
    const second = await caller.leitwegId.create({
      value: VALID_LWID_2,
      contractorId: CONTRACTOR_K1,
      isDefaultForContractor: true,
    });
    const updatedFirst = leitwegIds.get(first.id);
    const storedSecond = leitwegIds.get(second.id);
    expect(updatedFirst?.isDefaultForContractor).toBe(false);
    expect(storedSecond?.isDefaultForContractor).toBe(true);
    // Exactly one default for K1.
    const defaults = Array.from(leitwegIds.values()).filter(
      r => r.contractorId === CONTRACTOR_K1 && r.isDefaultForContractor,
    );
    expect(defaults).toHaveLength(1);
  });
});

describe('leitwegId.update — cross-tenant isolation', () => {
  it('rejects updating an orgA-owned row from an orgB caller as NOT_FOUND (not FORBIDDEN)', async () => {
    const orgARow = await makeCaller(ORG_A).leitwegId.create({
      value: VALID_LWID_1,
      isDefaultForContractor: false,
    });

    await expect(
      makeCaller(ORG_B).leitwegId.update({
        id: orgARow.id,
        description: 'attacker tries to tamper',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // The orgA row is untouched.
    const untouched = leitwegIds.get(orgARow.id);
    expect(untouched?.description).toBeNull();
    expect(untouched?.organizationId).toBe(ORG_A);
  });
});

describe('leitwegId.setDefault', () => {
  it('atomically promotes the target row and clears other defaults for the same contractor', async () => {
    const caller = makeCaller(ORG_A);
    const a = await caller.leitwegId.create({
      value: VALID_LWID_1,
      contractorId: CONTRACTOR_K1,
      isDefaultForContractor: true,
    });
    const b = await caller.leitwegId.create({
      value: VALID_LWID_2,
      contractorId: CONTRACTOR_K1,
      isDefaultForContractor: false,
    });
    // Unrelated contractor — must NOT be affected.
    const c = await caller.leitwegId.create({
      value: VALID_LWID_3,
      contractorId: CONTRACTOR_K2,
      isDefaultForContractor: true,
    });

    await caller.leitwegId.setDefault({ id: b.id });

    expect(leitwegIds.get(a.id)?.isDefaultForContractor).toBe(false);
    expect(leitwegIds.get(b.id)?.isDefaultForContractor).toBe(true);
    // K2's default untouched.
    expect(leitwegIds.get(c.id)?.isDefaultForContractor).toBe(true);

    const k1Defaults = Array.from(leitwegIds.values()).filter(
      r => r.contractorId === CONTRACTOR_K1 && r.isDefaultForContractor,
    );
    expect(k1Defaults).toHaveLength(1);
    expect(k1Defaults[0]?.id).toBe(b.id);
  });
});

describe('leitwegId.delete', () => {
  it('rejects deleting an orgA-owned row from an orgB caller as NOT_FOUND', async () => {
    const orgARow = await makeCaller(ORG_A).leitwegId.create({
      value: VALID_LWID_1,
      isDefaultForContractor: false,
    });

    await expect(makeCaller(ORG_B).leitwegId.delete({ id: orgARow.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    // Row is still there.
    expect(leitwegIds.get(orgARow.id)).toBeDefined();
  });

  it('deletes an own-org row (happy path)', async () => {
    const caller = makeCaller(ORG_A);
    const row = await caller.leitwegId.create({
      value: VALID_LWID_1,
      isDefaultForContractor: false,
    });
    await caller.leitwegId.delete({ id: row.id });
    expect(leitwegIds.get(row.id)).toBeUndefined();
  });
});

describe('leitwegId.list — multi-tenant isolation', () => {
  it('returns only rows from the caller organization', async () => {
    await makeCaller(ORG_A).leitwegId.create({
      value: VALID_LWID_1,
      isDefaultForContractor: false,
    });
    await makeCaller(ORG_A).leitwegId.create({
      value: VALID_LWID_2,
      isDefaultForContractor: false,
    });
    await makeCaller(ORG_B).leitwegId.create({
      value: VALID_LWID_3,
      isDefaultForContractor: false,
    });

    const orgAList = await makeCaller(ORG_A).leitwegId.list();
    const orgBList = await makeCaller(ORG_B).leitwegId.list();

    expect(orgAList).toHaveLength(2);
    expect(orgAList.every(r => r.value !== VALID_LWID_3)).toBe(true);
    expect(orgBList).toHaveLength(1);
    expect(orgBList[0]?.value).toBe(VALID_LWID_3);
  });
});

describe('leitwegId RBAC', () => {
  it('rejects a user without contractor:update permission with FORBIDDEN', async () => {
    permissionResult.success = false;
    vi.mocked(authApi.hasPermission).mockResolvedValueOnce({ success: false } as never);

    await expect(
      makeCaller(ORG_A).leitwegId.create({
        value: VALID_LWID_1,
        isDefaultForContractor: false,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(Array.from(leitwegIds.values())).toHaveLength(0);
  });
});

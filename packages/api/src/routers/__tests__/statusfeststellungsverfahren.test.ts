// ---------------------------------------------------------------------------
// statusfeststellungsverfahren router tests — Phase 60 CLASS-09.
// ---------------------------------------------------------------------------
//
// Covers VALIDATION.md rows 60-03-01 (create/update/delete happy path +
// conditional validFrom/validTo), 60-03-02 (cross-org leak — modelled at
// mock level), 60-03-06 (audit-writer invocation on each mutation).

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const ASSIGN_A = 'clasgnmentaaaaaaaaaaaaaaaa';

type Outcome = 'PENDING' | 'SELBSTANDIG' | 'ABHANGIG' | 'WITHDRAWN';

type Row = {
  id: string;
  organizationId: string;
  contractorAssignmentId: string;
  filedAt: Date;
  drvReference: string;
  outcome: Outcome;
  validFrom: Date | null;
  validTo: Date | null;
  notes: string | null;
};

const { mockPrisma, rows, mockHasPermission, auditCreate } = vi.hoisted(() => {
  const rows = new Map<string, Row>();
  const mockHasPermission = vi.fn().mockResolvedValue({ success: true });
  const auditCreate = vi.fn(async () => ({ id: 'aud-1' }));

  const mockPrisma = {
    statusfeststellungsverfahren: {
      findMany: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        return Array.from(rows.values()).filter(r => {
          if ('organizationId' in where && where.organizationId !== r.organizationId) return false;
          if (
            'contractorAssignmentId' in where &&
            where.contractorAssignmentId !== r.contractorAssignmentId
          )
            return false;
          return true;
        });
      }),
      findFirst: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        return (
          Array.from(rows.values()).find(r => {
            if ('organizationId' in where && where.organizationId !== r.organizationId)
              return false;
            if ('id' in where && where.id !== r.id) return false;
            return true;
          }) ?? null
        );
      }),
      create: vi.fn(async (args: { data: Omit<Row, 'id'> }) => {
        const id = `sfv-${rows.size + 1}`;
        const row: Row = { id, ...args.data } as Row;
        rows.set(id, row);
        return row;
      }),
      update: vi.fn(async (args: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.get(args.where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, args.data);
        return row;
      }),
      delete: vi.fn(async (args: { where: { id: string } }) => {
        const row = rows.get(args.where.id);
        if (!row) throw new Error('not found');
        rows.delete(args.where.id);
        return row;
      }),
    },
    auditLog: {
      create: auditCreate,
    },
    organization: {
      findUnique: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })),
    },
  };
  return { mockPrisma, rows, mockHasPermission, auditCreate };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: mockHasPermission,
    },
  },
  authApi: {
    hasPermission: mockHasPermission,
  },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T,>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
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
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), gauge: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@contractor-ops/feature-flags', async importOriginal => {
  // Multi-layer enforcement (D-05/D-06):
  //  1. root.ts evaluates `buildFlagBag` at module load to gate classification routers.
  //  2. classificationProcedure middleware calls `evaluate(...)` per-request.
  // Tests that exercise classification need both layers to return enabled=true.
  const actual = (await importOriginal()) as Record<string, unknown>;
  const enabledBag = {
    values: { 'module.classification-engine': true },
    isEnabled: (key: string) => key === 'module.classification-engine',
  };
  return {
    ...actual,
    buildFlagBag: vi.fn(() => enabledBag),
    lazyFlagBag: vi.fn(() => enabledBag),
    evaluate: vi.fn((key: string) =>
      key === 'module.classification-engine'
        ? { enabled: true, reason: 'mocked' }
        : { enabled: false, reason: 'mocked' },
    ),
  };
});

import { createCallerFactory } from '../../init.js';
import { appRouter } from '../../root.js';

const createCaller = createCallerFactory(appRouter);

function makeCaller(orgId = ORG_A, userId = USER_ID) {
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
      name: 'Test User',
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

function seed(): void {
  rows.clear();
  rows.set('sfv-seed', {
    id: 'sfv-seed',
    organizationId: ORG_A,
    contractorAssignmentId: ASSIGN_A,
    filedAt: new Date('2026-01-15'),
    drvReference: 'DRV-2026-0001',
    outcome: 'PENDING',
    validFrom: null,
    validTo: null,
    notes: null,
  });
}

beforeEach(() => {
  mockHasPermission.mockResolvedValue({ success: true });
  auditCreate.mockClear();
  seed();
});

describe('statusfeststellungsverfahren.create (60-03-01)', () => {
  it('creates a PENDING row without validFrom/validTo', async () => {
    const caller = makeCaller(ORG_A);
    const row = await caller.statusfeststellungsverfahren.create({
      contractorAssignmentId: ASSIGN_A,
      filedAt: new Date('2026-04-14'),
      drvReference: 'DRV-TEST-001',
      outcome: 'PENDING',
    });
    expect(row.outcome).toBe('PENDING');
    expect(row.validFrom).toBeNull();
    expect(row.validTo).toBeNull();
    // T-60-14 — audit row written for each mutation.
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });

  it('rejects SELBSTANDIG without validFrom/validTo (Zod refine)', async () => {
    const caller = makeCaller(ORG_A);
    await expect(
      caller.statusfeststellungsverfahren.create({
        contractorAssignmentId: ASSIGN_A,
        filedAt: new Date('2026-04-14'),
        drvReference: 'DRV-TEST-002',
        outcome: 'SELBSTANDIG',
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('accepts SELBSTANDIG with validFrom + validTo', async () => {
    const caller = makeCaller(ORG_A);
    const row = await caller.statusfeststellungsverfahren.create({
      contractorAssignmentId: ASSIGN_A,
      filedAt: new Date('2026-04-14'),
      drvReference: 'DRV-TEST-003',
      outcome: 'SELBSTANDIG',
      validFrom: new Date('2026-01-01'),
      validTo: new Date('2029-01-01'),
    });
    expect(row.outcome).toBe('SELBSTANDIG');
    expect(row.validFrom).toBeInstanceOf(Date);
  });

  it('rejects drvReference longer than 100 chars', async () => {
    const caller = makeCaller(ORG_A);
    await expect(
      caller.statusfeststellungsverfahren.create({
        contractorAssignmentId: ASSIGN_A,
        filedAt: new Date('2026-04-14'),
        drvReference: 'x'.repeat(101),
        outcome: 'PENDING',
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('rejects empty drvReference', async () => {
    const caller = makeCaller(ORG_A);
    await expect(
      caller.statusfeststellungsverfahren.create({
        contractorAssignmentId: ASSIGN_A,
        filedAt: new Date('2026-04-14'),
        drvReference: '',
        outcome: 'PENDING',
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('is rejected with FORBIDDEN when contractor:update is denied', async () => {
    mockHasPermission.mockResolvedValue({ success: false });
    const caller = makeCaller(ORG_A);
    await expect(
      caller.statusfeststellungsverfahren.create({
        contractorAssignmentId: ASSIGN_A,
        filedAt: new Date('2026-04-14'),
        drvReference: 'DRV-TEST-FORBIDDEN',
        outcome: 'PENDING',
      }),
    ).rejects.toBeInstanceOf(TRPCError);
    // Audit must NOT be written when permission is denied.
    expect(auditCreate).not.toHaveBeenCalled();
  });
});

describe('statusfeststellungsverfahren.listByEngagement (60-03-01)', () => {
  it('scopes the query to the given contractorAssignmentId', async () => {
    const caller = makeCaller(ORG_A);
    await caller.statusfeststellungsverfahren.listByEngagement({
      contractorAssignmentId: ASSIGN_A,
    });
    const args = mockPrisma.statusfeststellungsverfahren.findMany.mock.calls.at(-1)?.[0];
    expect(args?.where?.contractorAssignmentId).toBe(ASSIGN_A);
  });

  it('is rejected with FORBIDDEN when contractor:read is denied', async () => {
    mockHasPermission.mockResolvedValue({ success: false });
    const caller = makeCaller(ORG_A);
    await expect(
      caller.statusfeststellungsverfahren.listByEngagement({
        contractorAssignmentId: ASSIGN_A,
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});

describe('statusfeststellungsverfahren.update (60-03-01)', () => {
  it('patches drvReference and notes; unchanged fields retained', async () => {
    const caller = makeCaller(ORG_A);
    const updated = await caller.statusfeststellungsverfahren.update({
      id: 'sfv-seed',
      drvReference: 'DRV-UPDATED-999',
      notes: 'Updated note',
    });
    expect(updated.drvReference).toBe('DRV-UPDATED-999');
    expect(updated.outcome).toBe('PENDING'); // unchanged
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });

  it('rejects outcome transition to SELBSTANDIG without validFrom/validTo', async () => {
    const caller = makeCaller(ORG_A);
    await expect(
      caller.statusfeststellungsverfahren.update({
        id: 'sfv-seed',
        outcome: 'SELBSTANDIG',
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('returns NOT_FOUND for unknown id (cross-org contract)', async () => {
    const caller = makeCaller(ORG_A);
    await expect(
      caller.statusfeststellungsverfahren.update({
        id: 'sfv-does-not-exist',
        drvReference: 'DRV-NEW',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('statusfeststellungsverfahren.delete (60-03-01)', () => {
  it('hard-deletes the row and writes an audit entry', async () => {
    const caller = makeCaller(ORG_A);
    const result = await caller.statusfeststellungsverfahren.delete({ id: 'sfv-seed' });
    expect(result.id).toBe('sfv-seed');
    expect(rows.has('sfv-seed')).toBe(false);
    expect(auditCreate).toHaveBeenCalledTimes(1);
    const auditArgs = auditCreate.mock.calls.at(-1)?.[0] as {
      data: { action: string; resourceType: string };
    };
    expect(auditArgs.data.action).toBe('STATUSFESTSTELLUNGSVERFAHREN_DELETE');
    expect(auditArgs.data.resourceType).toBe('CONTRACTOR');
  });

  it('returns NOT_FOUND for unknown id', async () => {
    const caller = makeCaller(ORG_A);
    await expect(
      caller.statusfeststellungsverfahren.delete({ id: 'sfv-missing' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

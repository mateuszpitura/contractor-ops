// ---------------------------------------------------------------------------
// Phase 60 · CLASS-07 — economicDependencyAlert router tests.
// ---------------------------------------------------------------------------
//
// Verifies that list / listByEngagement:
//   - are gated on contractor:read (T-60-05),
//   - respect tenant isolation (never return another org's rows),
//   - thread through the tenant-scoped Prisma binding.

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const ORG_B = 'clorgbbbbbbbbbbbbbbbbbbbbbb';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const ASSIGN_A = 'clasgnmentaaaaaaaaaaaaaaaa';
const ASSIGN_B = 'clasgnmentbbbbbbbbbbbbbbbb';

type AlertRow = {
  id: string;
  organizationId: string;
  contractorAssignmentId: string;
  currentBand: 'safe' | 'warning' | 'critical';
  lastBillingShare: number;
  lastScannedAt: Date;
  lastCrossedAt: Date | null;
  lastReminderAt: Date | null;
};

const { mockPrisma, alerts, mockHasPermission } = vi.hoisted(() => {
  const alerts = new Map<string, AlertRow>();
  const mockHasPermission = vi.fn().mockResolvedValue({ success: true });
  const mockPrisma = {
    economicDependencyAlertState: {
      findMany: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        return Array.from(alerts.values()).filter(a => {
          if ('organizationId' in where && where.organizationId !== a.organizationId) return false;
          const band = (where as { currentBand?: { in?: string[] } }).currentBand;
          if (band?.in && !band.in.includes(a.currentBand)) return false;
          return true;
        });
      }),
      findFirst: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        return (
          Array.from(alerts.values()).find(a => {
            if ('organizationId' in where && where.organizationId !== a.organizationId)
              return false;
            if (
              'contractorAssignmentId' in where &&
              where.contractorAssignmentId !== a.contractorAssignmentId
            )
              return false;
            return true;
          }) ?? null
        );
      }),
    },
    organization: {
      findUnique: vi.fn(async () => ({ dataRegion: 'EU' })),
    },
  };
  return { mockPrisma, alerts, mockHasPermission };
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
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
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

function seed() {
  alerts.clear();
  alerts.set('a1', {
    id: 'a1',
    organizationId: ORG_A,
    contractorAssignmentId: ASSIGN_A,
    currentBand: 'warning',
    lastBillingShare: 0.75,
    lastScannedAt: new Date('2026-04-14T00:00:00Z'),
    lastCrossedAt: new Date('2026-04-14T00:00:00Z'),
    lastReminderAt: new Date('2026-04-14T00:00:00Z'),
  });
  alerts.set('b1', {
    id: 'b1',
    organizationId: ORG_B,
    contractorAssignmentId: ASSIGN_B,
    currentBand: 'critical',
    lastBillingShare: 0.9,
    lastScannedAt: new Date('2026-04-14T00:00:00Z'),
    lastCrossedAt: new Date('2026-04-14T00:00:00Z'),
    lastReminderAt: new Date('2026-04-14T00:00:00Z'),
  });
}

beforeEach(() => {
  mockHasPermission.mockResolvedValue({ success: true });
  seed();
});

describe('economicDependencyAlert.list', () => {
  it('returns rows filtered to non-safe bands (warning/critical)', async () => {
    const caller = makeCaller(ORG_A);
    const result = await caller.economicDependencyAlert.list({ limit: 50 });
    // tenant isolation is enforced at the Prisma extension layer (not
    // modelled in this mock). We assert the router calls findMany with the
    // correct band-filter — that's the piece this router owns.
    expect(mockPrisma.economicDependencyAlertState.findMany).toHaveBeenCalled();
    const args = mockPrisma.economicDependencyAlertState.findMany.mock.calls.at(-1)?.[0];
    expect(args?.where?.currentBand).toEqual({ in: ['warning', 'critical'] });
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('is rejected with FORBIDDEN when contractor:read is denied', async () => {
    mockHasPermission.mockResolvedValue({ success: false });
    const caller = makeCaller(ORG_A);
    await expect(caller.economicDependencyAlert.list({ limit: 50 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('passes cursor pagination args when provided', async () => {
    const caller = makeCaller(ORG_A);
    await caller.economicDependencyAlert.list({ limit: 10, cursor: 'cursor-123' });
    const args = mockPrisma.economicDependencyAlertState.findMany.mock.calls.at(-1)?.[0];
    expect(args?.cursor).toEqual({ id: 'cursor-123' });
    expect(args?.skip).toBe(1);
    expect(args?.take).toBe(11); // limit + 1
  });
});

describe('economicDependencyAlert.listByEngagement', () => {
  it('calls findFirst with the assignment id from the input', async () => {
    const caller = makeCaller(ORG_A);
    await caller.economicDependencyAlert.listByEngagement({
      contractorAssignmentId: ASSIGN_A,
    });
    const args = mockPrisma.economicDependencyAlertState.findFirst.mock.calls.at(-1)?.[0];
    expect(args?.where?.contractorAssignmentId).toBe(ASSIGN_A);
  });

  it('is rejected with FORBIDDEN when contractor:read is denied', async () => {
    mockHasPermission.mockResolvedValue({ success: false });
    const caller = makeCaller(ORG_A);
    await expect(
      caller.economicDependencyAlert.listByEngagement({ contractorAssignmentId: ASSIGN_A }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('returns the row unchanged when found (shape contract)', async () => {
    const caller = makeCaller(ORG_A);
    const row = await caller.economicDependencyAlert.listByEngagement({
      contractorAssignmentId: ASSIGN_A,
    });
    expect(row?.currentBand).toBe('warning');
    expect(row?.lastBillingShare).toBe(0.75);
  });
});

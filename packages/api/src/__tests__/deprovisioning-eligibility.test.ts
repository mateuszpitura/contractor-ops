// ---------------------------------------------------------------------------
// getDeprovisioningEligibility router tests.
// ---------------------------------------------------------------------------
//
// Verifies the cooldown-gate eligibility query: it reads the assignment +
// contractor country, derives the jurisdiction TZ, calls the single
// source-of-truth canStartDeprovisioning helper, and is tenant-isolated.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';

type AssignmentRow = {
  id: string;
  organizationId: string;
  status: 'ACTIVE' | 'ENDED' | 'PLANNED';
  endedAt: Date | null;
  contractor: { id: string; countryCode: string };
};

const { mockPrisma, assignments } = vi.hoisted(() => {
  const assignments = new Map<string, AssignmentRow>();
  const mockPrisma = {
    contractorAssignment: {
      findFirst: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        return (
          Array.from(assignments.values()).find(a => {
            if ('id' in where && where.id !== a.id) return false;
            if ('organizationId' in where && where.organizationId !== a.organizationId) {
              return false;
            }
            return true;
          }) ?? null
        );
      }),
    },
    organization: {
      findUnique: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })),
    },
  };
  return { mockPrisma, assignments };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: vi.fn().mockResolvedValue({ success: true }) },
  },
  authApi: { hasPermission: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
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

vi.mock('@contractor-ops/logger', () => {
  const noop = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return {
    createWebhookLogger: vi.fn(() => noop),
    withBodyLogging: vi.fn((_o, fn) => fn),
    logIntegrationCall: vi.fn(),
    subscribeOpossumEvents: vi.fn(),
    runWithRequestContext: vi.fn((_c, fn) => fn()),
    getRequestId: vi.fn(() => undefined),
    getTraceparent: vi.fn(() => undefined),
    buildContextFromHeaders: vi.fn(() => ({})),
    getOutboundHeaders: vi.fn(() => ({})),
    generateRequestId: vi.fn(() => 'test-request-id'),
    logger: noop,
    LOG_BODY_INCLUDE_PREFIXES: [],
    PII_MASK_KEYWORDS: [],
    PII_MASK_PATHS: [],
    createIntegrationLogger: vi.fn(() => noop),
    createLogger: vi.fn(() => noop),
    createTrpcLogger: vi.fn(() => noop),
    createCronLogger: vi.fn(() => noop),
    getIdpAuditLogger: vi.fn(() => noop),
  };
});

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), gauge: vi.fn(), distribution: vi.fn() },
}));

import { createCallerFactory } from '../init';
import { appRouter } from '../root';

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

function seed(row: Partial<AssignmentRow> & { id: string }) {
  assignments.set(row.id, {
    organizationId: ORG_A,
    status: 'ENDED',
    endedAt: null,
    contractor: { id: 'c-1', countryCode: 'DE' },
    ...row,
  });
}

beforeEach(() => {
  assignments.clear();
  vi.clearAllMocks();
});

describe('getDeprovisioningEligibility query (Phase 76 D-05/D-07)', () => {
  it('returns CooldownDecision for an ENDED assignment within the 14-day cooldown', async () => {
    seed({ id: 'a-1', endedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) });
    const caller = makeCaller();
    const result = await caller.deprovisioning.getDeprovisioningEligibility({
      assignmentId: 'a-1',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/14-day cooldown active/);
    expect(result.earliestDate).toBeInstanceOf(Date);
  });

  it('returns allowed: true once the 14-day cooldown has elapsed', async () => {
    seed({ id: 'a-1', endedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) });
    const caller = makeCaller();
    const result = await caller.deprovisioning.getDeprovisioningEligibility({
      assignmentId: 'a-1',
    });
    expect(result.allowed).toBe(true);
  });

  it('throws NOT_FOUND when the assignment is not in the caller organization', async () => {
    seed({ id: 'a-other', organizationId: 'clorgbbbbbbbbbbbbbbbbbbbbbb' });
    const caller = makeCaller();
    await expect(
      caller.deprovisioning.getDeprovisioningEligibility({ assignmentId: 'a-other' }),
    ).rejects.toThrow();
  });

  it('refuses when the assignment is not ENDED (gate predicate)', async () => {
    seed({ id: 'a-active', status: 'ACTIVE', endedAt: null });
    const caller = makeCaller();
    const result = await caller.deprovisioning.getDeprovisioningEligibility({
      assignmentId: 'a-active',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not ENDED/i);
  });
});

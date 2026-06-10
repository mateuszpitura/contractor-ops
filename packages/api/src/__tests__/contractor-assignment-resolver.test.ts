// ---------------------------------------------------------------------------
// contractorId → assignmentId resolver tests.
//
// The offboarding ACCESS_REVOKE task card only knows WorkflowRun.contractorId
// (there is no assignmentId FK on WorkflowRun). The deprovisioning trigger needs
// an unambiguous assignmentId, so the server-side resolver procedure
// (`deprovisioning.resolveAssignmentForContractor`) returns the MOST-RECENT
// ENDED assignment for the contractor (orderBy endedAt desc), or NOT_FOUND when
// the contractor has no ENDED assignment.
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const CONTRACTOR_ID = 'clcontractoraaaaaaaaaaaaaaa';

type AssignmentRow = {
  id: string;
  organizationId: string;
  contractorId: string;
  status: 'ACTIVE' | 'ENDED' | 'PLANNED';
  endedAt: Date | null;
};

const { mockPrisma, assignments, assignmentFindFirst } = vi.hoisted(() => {
  const assignments: AssignmentRow[] = [];
  // Mirrors a Prisma findFirst with where { contractorId, organizationId, status }
  // and orderBy { endedAt: 'desc' } — the expected resolver query shape.
  const assignmentFindFirst = vi.fn(
    async (args: { where?: Record<string, unknown>; orderBy?: { endedAt?: 'asc' | 'desc' } }) => {
      const where = args?.where ?? {};
      let matches = assignments.filter(a => {
        if ('contractorId' in where && where.contractorId !== a.contractorId) return false;
        if ('organizationId' in where && where.organizationId !== a.organizationId) return false;
        if ('status' in where && where.status !== a.status) return false;
        return true;
      });
      const dir = args?.orderBy?.endedAt;
      if (dir) {
        matches = matches.slice().sort((x, y) => {
          const xv = x.endedAt?.getTime() ?? 0;
          const yv = y.endedAt?.getTime() ?? 0;
          return dir === 'desc' ? yv - xv : xv - yv;
        });
      }
      return matches[0] ?? null;
    },
  );
  const mockPrisma = {
    contractorAssignment: { findFirst: assignmentFindFirst },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mockPrisma)),
    organization: { findUnique: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })) },
  };
  return { mockPrisma, assignments, assignmentFindFirst };
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
    run: (_c: unknown, fn: () => unknown) => fn(),
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
      name: 'T',
      email: `${userId}@x.com`,
      emailVerified: true,
      image: null,
      role: 'it_admin',
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

beforeEach(() => {
  vi.clearAllMocks();
  assignments.length = 0;
});

describe('resolveAssignmentForContractor — Phase 81 D-01 (RED)', () => {
  it('returns the MOST-RECENT ENDED assignment when several exist (orderBy endedAt desc)', async () => {
    const older = new Date('2026-01-10T00:00:00Z');
    const newer = new Date('2026-05-20T00:00:00Z');
    assignments.push(
      {
        id: 'a-old',
        organizationId: ORG_A,
        contractorId: CONTRACTOR_ID,
        status: 'ENDED',
        endedAt: older,
      },
      {
        id: 'a-new',
        organizationId: ORG_A,
        contractorId: CONTRACTOR_ID,
        status: 'ENDED',
        endedAt: newer,
      },
      // An ACTIVE assignment must be ignored — only ENDED rows are eligible.
      {
        id: 'a-active',
        organizationId: ORG_A,
        contractorId: CONTRACTOR_ID,
        status: 'ACTIVE',
        endedAt: null,
      },
    );
    const caller = makeCaller();
    const result = await caller.deprovisioning.resolveAssignmentForContractor({
      contractorId: CONTRACTOR_ID,
    });
    expect(result).toMatchObject({ assignmentId: 'a-new' });
    // The resolver must filter to ENDED and sort newest-first.
    expect(assignmentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          contractorId: CONTRACTOR_ID,
          organizationId: ORG_A,
          status: 'ENDED',
        }),
        orderBy: expect.objectContaining({ endedAt: 'desc' }),
      }),
    );
  });

  it('returns null / NOT_FOUND when the contractor has no ENDED assignment', async () => {
    assignments.push({
      id: 'a-active',
      organizationId: ORG_A,
      contractorId: CONTRACTOR_ID,
      status: 'ACTIVE',
      endedAt: null,
    });
    const caller = makeCaller();
    // The disambiguation rule: no ENDED assignment → the trigger cannot resolve a
    // target, so the resolver surfaces an empty result (null assignmentId) rather
    // than picking an ACTIVE row.
    const result = await caller.deprovisioning.resolveAssignmentForContractor({
      contractorId: CONTRACTOR_ID,
    });
    expect(result).toMatchObject({ assignmentId: null });
  });
});

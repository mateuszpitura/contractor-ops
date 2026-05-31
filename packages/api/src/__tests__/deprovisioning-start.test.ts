// ---------------------------------------------------------------------------
// Phase 76 D-03 — startDeprovisioningRun mutation tests.
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';

type AssignmentRow = {
  id: string;
  organizationId: string;
  status: 'ACTIVE' | 'ENDED' | 'PLANNED';
  endedAt: Date | null;
  contractorId: string;
  contractor: { id: string; countryCode: string; email: string | null };
};

const publishJSON = vi.fn().mockResolvedValue({ messageId: 'm-1' });

const { mockPrisma, assignments, runCreate, runUpdate, runFindUnique } = vi.hoisted(() => {
  const assignments = new Map<string, AssignmentRow>();
  const runCreate = vi.fn();
  const runUpdate = vi.fn().mockResolvedValue({});
  const runFindUnique = vi.fn();
  const mockPrisma = {
    contractorAssignment: {
      findFirst: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        return (
          Array.from(assignments.values()).find(a => {
            if ('id' in where && where.id !== a.id) return false;
            if ('organizationId' in where && where.organizationId !== a.organizationId)
              return false;
            return true;
          }) ?? null
        );
      }),
    },
    deprovisioningRun: { create: runCreate, update: runUpdate, findUniqueOrThrow: runFindUnique },
    // $transaction runs the callback against the same mock client.
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mockPrisma)),
    organization: { findUnique: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })) },
  };
  return { mockPrisma, assignments, runCreate, runUpdate, runFindUnique };
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

vi.mock('@contractor-ops/integrations/services/qstash-client', () => ({
  getQStashClient: () => ({ publishJSON }),
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

function seedEnded() {
  assignments.clear();
  assignments.set('a-1', {
    id: 'a-1',
    organizationId: ORG_A,
    status: 'ENDED',
    endedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // well past cooldown
    contractorId: 'c-1',
    contractor: { id: 'c-1', countryCode: 'DE', email: 'u@example.com' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  runUpdate.mockResolvedValue({});
  runCreate.mockResolvedValue({
    id: 'run-1',
    steps: [
      {
        id: 's-1',
        provider: 'GOOGLE_WORKSPACE',
        stepKind: 'SUSPEND_ACCOUNT',
        externalUserId: 'u@example.com',
      },
      {
        id: 's-2',
        provider: 'GOOGLE_WORKSPACE',
        stepKind: 'REVOKE_ALL_SESSIONS',
        externalUserId: 'u@example.com',
      },
    ],
  });
});

describe('startDeprovisioningRun mutation (Phase 76 D-03)', () => {
  it('rejects with FORBIDDEN when the cooldown gate denies (still ENDED < 14d)', async () => {
    assignments.clear();
    assignments.set('a-1', {
      id: 'a-1',
      organizationId: ORG_A,
      status: 'ENDED',
      endedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      contractorId: 'c-1',
      contractor: { id: 'c-1', countryCode: 'DE', email: 'u@example.com' },
    });
    const caller = makeCaller();
    await expect(
      caller.deprovisioning.startDeprovisioningRun({
        assignmentId: 'a-1',
        idempotencyKey: 'k-12345678',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(runCreate).not.toHaveBeenCalled();
  });

  it('inserts run + N steps in one transaction and flips status to IN_PROGRESS', async () => {
    seedEnded();
    const caller = makeCaller();
    const result = await caller.deprovisioning.startDeprovisioningRun({
      assignmentId: 'a-1',
      idempotencyKey: 'k-12345678',
    });
    expect(result).toEqual({ runId: 'run-1', idempotent: false });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const createArg = runCreate.mock.calls[0][0];
    expect(createArg.data.status).toBe('PENDING');
    expect(createArg.data.steps.create).toHaveLength(2); // GWS × {suspend, revoke}
    expect(runUpdate).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: { status: 'IN_PROGRESS' },
    });
  });

  it('fans out one independent QStash job per step (no aggregation)', async () => {
    seedEnded();
    const caller = makeCaller();
    await caller.deprovisioning.startDeprovisioningRun({
      assignmentId: 'a-1',
      idempotencyKey: 'k-12345678',
    });
    expect(publishJSON).toHaveBeenCalledTimes(2);
    const firstJob = publishJSON.mock.calls[0][0];
    expect(firstJob.url).toMatch(/\/idp-deprovisioning\/_step-runner$/);
    expect(firstJob.deduplicationId).toBe('run-1:s-1:0');
    expect(firstJob.retries).toBe(3);
  });

  it('idempotent — P2002 on idempotencyKey returns the existing run', async () => {
    seedEnded();
    runCreate.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    runFindUnique.mockResolvedValue({ id: 'run-existing' });
    const caller = makeCaller();
    const result = await caller.deprovisioning.startDeprovisioningRun({
      assignmentId: 'a-1',
      idempotencyKey: 'k-12345678',
    });
    expect(result).toEqual({ runId: 'run-existing', idempotent: true });
  });

  it('rejects PRECONDITION_FAILED when the contractor has no email', async () => {
    assignments.clear();
    assignments.set('a-1', {
      id: 'a-1',
      organizationId: ORG_A,
      status: 'ENDED',
      endedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      contractorId: 'c-1',
      contractor: { id: 'c-1', countryCode: 'DE', email: null },
    });
    const caller = makeCaller();
    await expect(
      caller.deprovisioning.startDeprovisioningRun({
        assignmentId: 'a-1',
        idempotencyKey: 'k-12345678',
      }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
});

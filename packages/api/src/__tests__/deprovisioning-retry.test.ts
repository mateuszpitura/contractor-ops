// ---------------------------------------------------------------------------
// retryDeprovisioningStep mutation tests.
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';

type StepRow = {
  id: string;
  runId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED';
  attempts: number;
  provider: string;
  stepKind: string;
  externalUserId: string;
};

const publishJSON = vi.fn().mockResolvedValue({ messageId: 'm-1' });

const { mockPrisma, steps, updateMany } = vi.hoisted(() => {
  const steps = new Map<string, StepRow>();
  const updateMany = vi.fn();
  const mockPrisma = {
    deprovisioningStep: {
      findFirst: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        return (
          Array.from(steps.values()).find(s => ('id' in where ? where.id === s.id : true)) ?? null
        );
      }),
      updateMany,
    },
    organization: { findUnique: vi.fn(async () => ({ dataRegion: 'EU', status: 'ACTIVE' })) },
  };
  return { mockPrisma, steps, updateMany };
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

function seedStep(overrides: Partial<StepRow> = {}) {
  steps.clear();
  steps.set('s-1', {
    id: 's-1',
    runId: 'run-1',
    status: 'FAILED',
    attempts: 2,
    provider: 'GOOGLE_WORKSPACE',
    stepKind: 'SUSPEND_ACCOUNT',
    externalUserId: 'u@example.com',
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMany.mockResolvedValue({ count: 1 });
});

describe('retryDeprovisioningStep mutation (Phase 76 D-04)', () => {
  it('returns { noop: true } when the step is not in FAILED state', async () => {
    seedStep({ status: 'SUCCEEDED' });
    const caller = makeCaller();
    const result = await caller.deprovisioning.retryDeprovisioningStep({ stepId: 's-1' });
    expect(result).toEqual({ noop: true, reason: 'step not in FAILED state' });
    expect(publishJSON).not.toHaveBeenCalled();
  });

  it('resets attempts=0, status=PENDING, lastErrorMessage=null on a FAILED step', async () => {
    seedStep();
    const caller = makeCaller();
    await caller.deprovisioning.retryDeprovisioningStep({ stepId: 's-1' });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 's-1', status: 'FAILED' },
      data: { status: 'PENDING', attempts: 0, lastErrorMessage: null },
    });
  });

  it('enqueues a fresh QStash job with deduplicationId runId:stepId:nextAttempt', async () => {
    seedStep({ attempts: 2 });
    const caller = makeCaller();
    await caller.deprovisioning.retryDeprovisioningStep({ stepId: 's-1' });
    expect(publishJSON).toHaveBeenCalledTimes(1);
    expect(publishJSON.mock.calls[0][0].deduplicationId).toBe('run-1:s-1:3');
  });

  it('returns ok: true on a successful retry', async () => {
    seedStep();
    const caller = makeCaller();
    const result = await caller.deprovisioning.retryDeprovisioningStep({ stepId: 's-1' });
    expect(result).toEqual({ ok: true });
  });

  it('double-click — optimistic-concurrency updateMany count=0 returns noop, no enqueue', async () => {
    seedStep();
    updateMany.mockResolvedValue({ count: 0 });
    const caller = makeCaller();
    const result = await caller.deprovisioning.retryDeprovisioningStep({ stepId: 's-1' });
    expect(result).toEqual({ noop: true, reason: 'step state changed concurrently' });
    expect(publishJSON).not.toHaveBeenCalled();
  });
});

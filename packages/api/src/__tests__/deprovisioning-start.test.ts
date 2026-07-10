// ---------------------------------------------------------------------------
// startDeprovisioningRun mutation tests.
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const { mockPrisma, assignments, runCreate, runUpdate, runFindUnique, orgSettings } = vi.hoisted(
  () => {
    const assignments = new Map<string, AssignmentRow>();
    // Per-org idpDeprovisioningEnabled toggle map. Mutated per-test;
    // startDeprovisioningRun reads `organization.findUnique({ select: { settingsJson } })`
    // to derive the run's provider set from this.
    const orgSettings: { idpDeprovisioningEnabled: Record<string, boolean> } = {
      idpDeprovisioningEnabled: { GOOGLE_WORKSPACE: true },
    };
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
              if ('status' in where && where.status !== a.status) return false;
              return true;
            }) ?? null
          );
        }),
        count: vi.fn(async () => 0),
      },
      deprovisioningRun: { create: runCreate, update: runUpdate, findUniqueOrThrow: runFindUnique },
      // retryDeprovisioningStep fetches the step before any QStash enqueue; the
      // gate (idp:start_run) runs BEFORE this, so the deny-case test never reaches it.
      deprovisioningStep: {
        findFirst: vi.fn(async () => ({
          id: 's-1',
          runId: 'run-1',
          status: 'FAILED',
          attempts: 1,
          provider: 'GOOGLE_WORKSPACE',
          stepKind: 'SUSPEND_ACCOUNT',
          externalUserId: 'u@example.com',
        })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      // $transaction runs the callback against the same mock client.
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mockPrisma)),
      organization: {
        // startDeprovisioningRun reads settingsJson to derive enabled providers.
        // Returns BOTH the existing region/status shape AND the toggle map so the
        // single mock satisfies the legacy reads and the provider derivation.
        findUnique: vi.fn(async () => ({
          dataRegion: 'EU',
          status: 'ACTIVE',
          settingsJson: { ...orgSettings },
        })),
      },
    };
    return { mockPrisma, assignments, runCreate, runUpdate, runFindUnique, orgSettings };
  },
);

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

import { authApi } from '@contractor-ops/auth';
import { DEPROVISIONING_INTEGRATION_NOT_CONFIGURED } from '../errors';
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
  // The run provider-set derivation gates each provider on its signoff flag.
  // Bypass the flag service in unit tests so the default GWS-enabled org derives
  // GWS (mirrors the legacy single-provider behaviour). Individual multi-provider
  // cases re-assert this; the empty-set cases rely on the enabled map being empty
  // or non-resolver-backed, not on signoff.
  process.env.FLAG_SIGNOFF_BYPASS = 'local';
  // Default org has only GWS enabled (matches the legacy single-provider behaviour).
  orgSettings.idpDeprovisioningEnabled = { GOOGLE_WORKSPACE: true };
  // Echo the steps the router asked us to create so multi-provider assertions can
  // read the derived provider set off the returned run (mirrors a real insert).
  runCreate.mockImplementation(async (args: { data?: { steps?: { create?: unknown[] } } }) => {
    const created = (args?.data?.steps?.create ?? []) as Array<{
      provider: string;
      stepKind: string;
      externalUserId: string;
    }>;
    const steps =
      created.length > 0
        ? created.map((s, i) => ({
            id: `s-${i + 1}`,
            provider: s.provider,
            stepKind: s.stepKind,
            externalUserId: s.externalUserId,
          }))
        : [
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
          ];
    return { id: 'run-1', steps };
  });
  vi.mocked(authApi.hasPermission).mockResolvedValue({ success: true } as never);
});

afterEach(() => {
  // Don't leak the signoff bypass into other test files in the same worker.
  process.env.FLAG_SIGNOFF_BYPASS = undefined;
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
        subjectType: 'CONTRACTOR',
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
      subjectType: 'CONTRACTOR',
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
      subjectType: 'CONTRACTOR',
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
      subjectType: 'CONTRACTOR',
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
        subjectType: 'CONTRACTOR',
        assignmentId: 'a-1',
        idempotencyKey: 'k-12345678',
      }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
});

// ---------------------------------------------------------------------------
// Extended startDeprovisioningRun contract assertions.
//
// These assert the wired contract: dynamic multi-provider derivation, the
// empty-set precondition, the idp:start_run gate, and the per-assignment
// idempotency key.
// ---------------------------------------------------------------------------

describe('startDeprovisioningRun — Phase 81 D-05 multi-provider derivation (RED)', () => {
  it('creates steps for BOTH providers when GWS + Slack are enabled + signoff-satisfied', async () => {
    process.env.FLAG_SIGNOFF_BYPASS = 'local';
    seedEnded();
    orgSettings.idpDeprovisioningEnabled = { GOOGLE_WORKSPACE: true, SLACK: true };
    const caller = makeCaller();
    await caller.deprovisioning.startDeprovisioningRun({
      subjectType: 'CONTRACTOR',
      assignmentId: 'a-1',
      idempotencyKey: 'k-12345678',
    });
    const createArg = runCreate.mock.calls[0]?.[0];
    const created = (createArg?.data?.steps?.create ?? []) as Array<{ provider: string }>;
    const providers = new Set(created.map(s => s.provider));
    expect(providers).toEqual(new Set(['GOOGLE_WORKSPACE', 'SLACK']));
    // suspend + revoke per provider
    expect(created).toHaveLength(4);
    process.env.FLAG_SIGNOFF_BYPASS = undefined;
  });

  it('creates GWS-only steps when only GOOGLE_WORKSPACE is enabled', async () => {
    process.env.FLAG_SIGNOFF_BYPASS = 'local';
    seedEnded();
    orgSettings.idpDeprovisioningEnabled = { GOOGLE_WORKSPACE: true };
    const caller = makeCaller();
    await caller.deprovisioning.startDeprovisioningRun({
      subjectType: 'CONTRACTOR',
      assignmentId: 'a-1',
      idempotencyKey: 'k-12345678',
    });
    const createArg = runCreate.mock.calls[0]?.[0];
    const created = (createArg?.data?.steps?.create ?? []) as Array<{ provider: string }>;
    const providers = new Set(created.map(s => s.provider));
    expect(providers).toEqual(new Set(['GOOGLE_WORKSPACE']));
    expect(created).toHaveLength(2);
    process.env.FLAG_SIGNOFF_BYPASS = undefined;
  });
});

describe('startDeprovisioningRun — Phase 81 D-06 empty provider set (RED)', () => {
  it('rejects PRECONDITION_FAILED with DEPROVISIONING_INTEGRATION_NOT_CONFIGURED and creates no run', async () => {
    process.env.FLAG_SIGNOFF_BYPASS = 'local';
    seedEnded();
    // No enabled + signoff + resolver-backed provider → empty derived set.
    orgSettings.idpDeprovisioningEnabled = {};
    const caller = makeCaller();
    await expect(
      caller.deprovisioning.startDeprovisioningRun({
        subjectType: 'CONTRACTOR',
        assignmentId: 'a-1',
        idempotencyKey: 'k-12345678',
      }),
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: DEPROVISIONING_INTEGRATION_NOT_CONFIGURED,
    });
    expect(runCreate).not.toHaveBeenCalled();
    process.env.FLAG_SIGNOFF_BYPASS = undefined;
  });

  it('rejects when a provider is enabled but NOT resolver-backed (e.g. ENTRA)', async () => {
    process.env.FLAG_SIGNOFF_BYPASS = 'local';
    seedEnded();
    // ENTRA is registered but has no token resolver — it must NOT contribute steps,
    // leaving the derived set empty → precondition throw.
    orgSettings.idpDeprovisioningEnabled = { ENTRA: true };
    const caller = makeCaller();
    await expect(
      caller.deprovisioning.startDeprovisioningRun({
        subjectType: 'CONTRACTOR',
        assignmentId: 'a-1',
        idempotencyKey: 'k-12345678',
      }),
    ).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: DEPROVISIONING_INTEGRATION_NOT_CONFIGURED,
    });
    expect(runCreate).not.toHaveBeenCalled();
    process.env.FLAG_SIGNOFF_BYPASS = undefined;
  });
});

describe('startDeprovisioningRun — Phase 81 D-10 idp:start_run gate (RED)', () => {
  it('rejects startDeprovisioningRun with FORBIDDEN when hasPermission denies idp:start_run', async () => {
    seedEnded();
    vi.mocked(authApi.hasPermission).mockResolvedValue({ success: false } as never);
    const caller = makeCaller();
    await expect(
      caller.deprovisioning.startDeprovisioningRun({
        subjectType: 'CONTRACTOR',
        assignmentId: 'a-1',
        idempotencyKey: 'k-12345678',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(runCreate).not.toHaveBeenCalled();
  });

  it('rejects getDeprovisioningEligibility with FORBIDDEN when hasPermission denies idp:start_run', async () => {
    seedEnded();
    vi.mocked(authApi.hasPermission).mockResolvedValue({ success: false } as never);
    const caller = makeCaller();
    await expect(
      caller.deprovisioning.getDeprovisioningEligibility({ assignmentId: 'a-1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects retryDeprovisioningStep with FORBIDDEN when hasPermission denies idp:start_run', async () => {
    // Retry re-enqueues the same destructive SUSPEND/REVOKE job, so it
    // carries the SAME idp:start_run gate as the start path. A denied caller
    // must never reach the step lookup or the QStash enqueue.
    vi.mocked(authApi.hasPermission).mockResolvedValue({ success: false } as never);
    const caller = makeCaller();
    await expect(
      caller.deprovisioning.retryDeprovisioningStep({ stepId: 's-1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(publishJSON).not.toHaveBeenCalled();
  });
});

describe('startDeprovisioningRun — Phase 81 D-09 per-assignment idempotency key (RED)', () => {
  it('a re-trigger with the SAME assignment-derived key returns the existing run (P2002)', async () => {
    seedEnded();
    // The UI derives a stable key from assignmentId. A double-click re-runs with the
    // same key; the unique index raises P2002 and the mutation returns the
    // EXISTING run rather than creating a second one or throwing.
    const assignmentDerivedKey = 'assign-a-1-deprov';
    runCreate.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));
    runFindUnique.mockResolvedValueOnce({ id: 'run-existing' });
    const caller = makeCaller();
    const result = await caller.deprovisioning.startDeprovisioningRun({
      subjectType: 'CONTRACTOR',
      assignmentId: 'a-1',
      idempotencyKey: assignmentDerivedKey,
    });
    expect(result).toEqual({ runId: 'run-existing', idempotent: true });
    // The existing-run lookup MUST be scoped by the per-org composite unique on the
    // assignment-derived key (no cross-tenant key squatting).
    expect(runFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_idempotencyKey: {
            organizationId: ORG_A,
            idempotencyKey: assignmentDerivedKey,
          },
        },
      }),
    );
  });
});

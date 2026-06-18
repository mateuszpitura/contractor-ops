// ---------------------------------------------------------------------------
// overrideStepFailure mutation tests.
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';

type StepRow = {
  id: string;
  runId: string;
  status: string;
  attempts: number;
  provider: string;
};

const { mockPrisma, steps, stepUpdate, recomputeRunStatus, writeAuditLog } = vi.hoisted(() => {
  const steps = new Map<string, StepRow>();
  const stepUpdate = vi.fn(async () => ({}));
  const recomputeRunStatus = vi.fn(async () => 'COMPLETED' as const);
  const writeAuditLog = vi.fn(async () => undefined);
  const mockPrisma = {
    deprovisioningStep: {
      findFirst: vi.fn(async (args: { where?: { id?: string } }) => {
        const id = args?.where?.id;
        return (id && steps.get(id)) || null;
      }),
      update: stepUpdate,
    },
    // Tenant middleware resolves org meta via prisma.organization.findUnique.
    organization: {
      findUnique: vi.fn(async () => ({ id: ORG_A, dataRegion: 'EU', status: 'ACTIVE' })),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mockPrisma)),
  };
  return { mockPrisma, steps, stepUpdate, recomputeRunStatus, writeAuditLog };
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

vi.mock('@contractor-ops/idp-saga', () => ({
  canStartDeprovisioning: vi.fn(),
  MAX_ATTEMPTS: 3,
  recomputeRunStatus,
}));

vi.mock('../services/audit-writer', () => ({ writeAuditLog }));

vi.mock('@contractor-ops/logger', () => {
  const noop = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return {
    createLogger: vi.fn(() => noop),
    createTrpcLogger: vi.fn(() => noop),
    createCronLogger: vi.fn(() => noop),
    createIntegrationLogger: vi.fn(() => noop),
    createWebhookLogger: vi.fn(() => noop),
    getIdpAuditLogger: vi.fn(() => noop),
    runWithRequestContext: vi.fn((_c, fn) => fn()),
    getRequestId: vi.fn(() => undefined),
    getTraceparent: vi.fn(() => undefined),
    generateRequestId: vi.fn(() => 'r-1'),
    logger: noop,
    PII_MASK_PATHS: [],
    PII_MASK_KEYWORDS: [],
    LOG_BODY_INCLUDE_PREFIXES: [],
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
      id: `s-${userId}`,
      userId,
      activeOrganizationId: orgId,
      expiresAt: new Date('2099-01-01'),
      token: 't',
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

const VALID_NOTE = 'Confirmed suspended directly in the Google Admin console after the API failed.';

beforeEach(() => {
  vi.clearAllMocks();
  steps.clear();
});

describe('overrideStepFailure (Phase 77 D-12)', () => {
  it('marks a terminally-failed step MANUAL_COMPLETED + audits + recomputes', async () => {
    steps.set('step-1', {
      id: 'step-1',
      runId: 'run-1',
      status: 'FAILED',
      attempts: 3,
      provider: 'GOOGLE_WORKSPACE',
    });
    const caller = makeCaller();
    const result = await caller.deprovisioning.overrideStepFailure({
      stepId: 'step-1',
      category: 'verified_via_vendor_console',
      note: VALID_NOTE,
    });
    expect(result.ok).toBe(true);
    expect(stepUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'MANUAL_COMPLETED',
          manualOverrideCategory: 'verified_via_vendor_console',
          manualOverriddenByUserId: USER_ID,
        }),
      }),
    );
    expect(recomputeRunStatus).toHaveBeenCalled();
    // step-level audit + run-completed-via-override audit (run reached COMPLETED).
    expect(writeAuditLog).toHaveBeenCalledTimes(2);
  });

  it('does NOT log the free-text note in the audit payload (D-13)', async () => {
    steps.set('step-1', {
      id: 'step-1',
      runId: 'run-1',
      status: 'FAILED',
      attempts: 3,
      provider: 'SLACK',
    });
    await makeCaller().deprovisioning.overrideStepFailure({
      stepId: 'step-1',
      category: 'other',
      note: VALID_NOTE,
    });
    const stepAudit = writeAuditLog.mock.calls.find(
      (c: any[]) => c[0]?.action === 'idp.deprovisioning.step.manual_completed',
    );
    expect(JSON.stringify(stepAudit?.[0]?.newValues)).not.toContain(VALID_NOTE);
  });

  it('rejects a step that is not FAILED-at-MAX (PRECONDITION_FAILED)', async () => {
    steps.set('step-1', {
      id: 'step-1',
      runId: 'run-1',
      status: 'FAILED',
      attempts: 1,
      provider: 'GOOGLE_WORKSPACE',
    });
    await expect(
      makeCaller().deprovisioning.overrideStepFailure({
        stepId: 'step-1',
        category: 'other',
        note: VALID_NOTE,
      }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(stepUpdate).not.toHaveBeenCalled();
  });

  it('rejects a note shorter than 20 chars (server-side Zod)', async () => {
    steps.set('step-1', {
      id: 'step-1',
      runId: 'run-1',
      status: 'FAILED',
      attempts: 3,
      provider: 'GOOGLE_WORKSPACE',
    });
    await expect(
      makeCaller().deprovisioning.overrideStepFailure({
        stepId: 'step-1',
        category: 'other',
        note: 'too short',
      }),
    ).rejects.toThrow();
  });
});

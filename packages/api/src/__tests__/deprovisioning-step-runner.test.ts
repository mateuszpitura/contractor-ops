// ---------------------------------------------------------------------------
// Phase 76 D-03 — deprovisioning step-runner service tests.
// ---------------------------------------------------------------------------
//
// Verifies the saga step contract: MAX_ATTEMPTS short-circuit, provenance-before-adapter
// ordering, SHA-256 hash persistence, recomputeRunStatus after every transition,
// USER_NOT_FOUND → SUCCEEDED, and audit-log emission.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callOrder, suspendAccount, recomputeRunStatus, insertProvenance, auditInfo } = vi.hoisted(
  () => {
    const callOrder: string[] = [];
    return {
      callOrder,
      suspendAccount: vi.fn(async () => {
        callOrder.push('adapter');
        return {
          status: 'SUCCEEDED',
          requestSha256: 'a'.repeat(64),
          responseSha256: 'b'.repeat(64),
        };
      }),
      recomputeRunStatus: vi.fn(async () => 'COMPLETED' as const),
      insertProvenance: vi.fn(async () => {
        callOrder.push('provenance');
        return { id: 'p-1' };
      }),
      auditInfo: vi.fn(),
    };
  },
);

vi.mock('@contractor-ops/idp-saga', () => ({
  MAX_ATTEMPTS: 3,
  recomputeRunStatus,
  insertProvenance,
}));

vi.mock('@contractor-ops/integrations', () => ({
  getDeprovisionableAdapter: vi.fn(() => ({
    suspendAccount,
    revokeAllSessions: vi.fn(),
    verifyDeprovisioned: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({ info: auditInfo, warn: vi.fn(), error: vi.fn() })),
}));

import { runDeprovisioningStep } from '../services/idp-deprovisioning-step-runner';

type StepRow = {
  id: string;
  runId: string;
  status: string;
  attempts: number;
};

function makeDb(step: StepRow) {
  const update = vi.fn(async () => ({}));
  const db = {
    deprovisioningStep: {
      findUniqueOrThrow: vi.fn(async () => step),
      update,
    },
    deprovisioningRun: { update: vi.fn(async () => ({})) },
  };
  return { db, update };
}

const body = {
  runId: 'run-1',
  stepId: 's-1',
  organizationId: 'org-1',
  provider: 'GOOGLE_WORKSPACE' as const,
  stepKind: 'SUSPEND_ACCOUNT' as const,
  externalUserId: 'u@example.com',
};

beforeEach(() => {
  vi.clearAllMocks();
  callOrder.length = 0;
});

describe('runDeprovisioningStep (Phase 76 D-03)', () => {
  it('reads the step by id from the body', async () => {
    const { db } = makeDb({ id: 's-1', runId: 'run-1', status: 'PENDING', attempts: 0 });
    // biome-ignore lint/suspicious/noExplicitAny: mock db
    await runDeprovisioningStep(db as any, body);
    expect(db.deprovisioningStep.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 's-1' },
      select: { id: true, runId: true, status: true, attempts: true },
    });
  });

  it('short-circuits to FAILED when attempts >= MAX_ATTEMPTS', async () => {
    const { db, update } = makeDb({
      id: 's-1',
      runId: 'run-1',
      status: 'IN_PROGRESS',
      attempts: 3,
    });
    // biome-ignore lint/suspicious/noExplicitAny: mock db
    const result = await runDeprovisioningStep(db as any, body);
    expect(result).toEqual({ ok: false, reason: 'max-attempts' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(suspendAccount).not.toHaveBeenCalled();
    expect(recomputeRunStatus).toHaveBeenCalled();
  });

  it('inserts provenance BEFORE calling the adapter', async () => {
    const { db } = makeDb({ id: 's-1', runId: 'run-1', status: 'PENDING', attempts: 0 });
    // biome-ignore lint/suspicious/noExplicitAny: mock db
    await runDeprovisioningStep(db as any, body);
    expect(callOrder).toEqual(['provenance', 'adapter']);
  });

  it('persists the adapter result SHA-256 hashes onto the step', async () => {
    const { db, update } = makeDb({ id: 's-1', runId: 'run-1', status: 'PENDING', attempts: 0 });
    // biome-ignore lint/suspicious/noExplicitAny: mock db
    await runDeprovisioningStep(db as any, body);
    const resultUpdate = update.mock.calls.find(
      // biome-ignore lint/suspicious/noExplicitAny: inspecting mock args
      (c: any[]) => c[0]?.data?.requestSha256 !== undefined,
    );
    expect(resultUpdate?.[0].data.requestSha256).toBe('a'.repeat(64));
    expect(resultUpdate?.[0].data.responseSha256).toBe('b'.repeat(64));
    expect(resultUpdate?.[0].data.status).toBe('SUCCEEDED');
  });

  it('calls recomputeRunStatus after the step transition', async () => {
    const { db } = makeDb({ id: 's-1', runId: 'run-1', status: 'PENDING', attempts: 0 });
    // biome-ignore lint/suspicious/noExplicitAny: mock db
    await runDeprovisioningStep(db as any, body);
    expect(recomputeRunStatus).toHaveBeenCalledWith(db, 'run-1');
  });

  it('maps USER_NOT_FOUND to SUCCEEDED and emits a full audit entry', async () => {
    suspendAccount.mockResolvedValueOnce({
      status: 'FAILED',
      failureKind: 'USER_NOT_FOUND',
      requestSha256: 'c'.repeat(64),
      responseSha256: 'd'.repeat(64),
    });
    const { db, update } = makeDb({ id: 's-1', runId: 'run-1', status: 'PENDING', attempts: 0 });
    // biome-ignore lint/suspicious/noExplicitAny: mock db
    const result = await runDeprovisioningStep(db as any, body);
    expect(result.ok).toBe(true);
    const resultUpdate = update.mock.calls.find(
      // biome-ignore lint/suspicious/noExplicitAny: inspecting mock args
      (c: any[]) => c[0]?.data?.requestSha256 !== undefined,
    );
    expect(resultUpdate?.[0].data.status).toBe('SUCCEEDED');
    expect(auditInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        auditEvent: 'deprovision_step_completed',
        runId: 'run-1',
        stepId: 's-1',
        requestSha256: 'c'.repeat(64),
        failureKind: 'USER_NOT_FOUND',
      }),
      expect.any(String),
    );
  });
});

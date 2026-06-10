// ---------------------------------------------------------------------------
// Phase 77 D-04/D-05/D-06 — deprovisioning step-runner service tests.
// ---------------------------------------------------------------------------
//
// Verifies the upgraded saga step contract: MAX_ATTEMPTS short-circuit,
// provenance-before-adapter ordering, errorClass + SHA-256 persistence,
// LIKELY_GONE → SUCCEEDED-equivalent, the GWS three-audit-row sub-action mapping,
// and recomputeRunStatus after every transition. The token resolver is stubbed to
// fall back to the registry adapter so the adapter call is fully mockable.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  callOrder,
  suspendAccount,
  revokeAllSessions,
  recomputeRunStatus,
  insertProvenance,
  auditInfo,
} = vi.hoisted(() => {
  const callOrder: string[] = [];
  return {
    callOrder,
    suspendAccount: vi.fn(async () => {
      callOrder.push('adapter');
      return { status: 'SUCCEEDED', requestSha256: 'a'.repeat(64), responseSha256: 'b'.repeat(64) };
    }),
    revokeAllSessions: vi.fn(async () => ({
      status: 'SUCCEEDED',
      requestSha256: 'e'.repeat(64),
      responseSha256: 'f'.repeat(64),
      subActions: [
        {
          kind: 'revoke_oauth_grants',
          requestSha256: '1'.repeat(64),
          responseSha256: '2'.repeat(64),
        },
        {
          kind: 'sign_out_sessions',
          requestSha256: '3'.repeat(64),
          responseSha256: '4'.repeat(64),
        },
      ],
    })),
    recomputeRunStatus: vi.fn(async () => 'COMPLETED' as const),
    insertProvenance: vi.fn(async () => {
      callOrder.push('provenance');
      return { id: 'p-1' };
    }),
    auditInfo: vi.fn(),
  };
});

vi.mock('@contractor-ops/idp-saga', () => ({
  MAX_ATTEMPTS: 3,
  recomputeRunStatus,
  insertProvenance,
}));

vi.mock('@contractor-ops/integrations', () => ({
  getDeprovisionableAdapter: vi.fn(() => ({
    suspendAccount,
    revokeAllSessions,
    verifyDeprovisioned: vi.fn(),
    describeImpact: vi.fn(),
  })),
  createConfiguredDeprovisionableAdapter: vi.fn(() => ({
    suspendAccount,
    revokeAllSessions,
    verifyDeprovisioned: vi.fn(),
    describeImpact: vi.fn(),
  })),
}));
// Stub the concrete adapter modules (imported for token-configured construction).
// withAccessToken/withOrgGridToken return an object with the same suspend/revoke
// mocks so the happy-path tests exercise the token-configured adapter code path.
vi.mock('@contractor-ops/integrations/adapters/google-workspace-adapter', () => ({
  GoogleWorkspaceAdapter: class {
    withAccessToken() {
      return {
        suspendAccount,
        revokeAllSessions,
        verifyDeprovisioned: vi.fn(),
        describeImpact: vi.fn(),
      };
    }
  },
}));
vi.mock('@contractor-ops/integrations/adapters/slack-adapter', () => ({
  SlackAdapter: class {
    withOrgGridToken() {
      return {
        suspendAccount,
        revokeAllSessions,
        verifyDeprovisioned: vi.fn(),
        describeImpact: vi.fn(),
      };
    }
  },
}));
// Default: token resolver succeeds (GWS connected). Individual tests override this.
vi.mock('../services/idp-token-resolver', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/idp-token-resolver')>();
  return {
    ...actual,
    resolveDeprovisionToken: vi.fn(async () => ({ ok: true, accessToken: 'tok-test' })),
  };
});

vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  getIdpAuditLogger: vi.fn(() => ({ info: auditInfo, warn: vi.fn(), error: vi.fn() })),
  // hashExternalUserId is a pure crypto helper; use the real implementation so
  // audit assertions work without coupling tests to a specific hash value.
  hashExternalUserId: (id: string) => `sha256:${id}`,
}));

import {
  runDeprovisioningStep,
  StepOrgMismatchError,
} from '../services/idp-deprovisioning-step-runner';

type StepRow = {
  id: string;
  runId: string;
  status: string;
  attempts: number;
  organizationId: string;
};

function makeDb(step: StepRow | null) {
  const update = vi.fn(async () => ({}));
  const db = {
    deprovisioningStep: { findUnique: vi.fn(async () => step), update },
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

describe('runDeprovisioningStep (Phase 77 D-04/D-05/D-06)', () => {
  it('short-circuits to FAILED when attempts >= MAX_ATTEMPTS', async () => {
    const { db, update } = makeDb({
      id: 's-1',
      runId: 'run-1',
      status: 'IN_PROGRESS',
      attempts: 3,
      organizationId: 'org-1',
    });
    // biome-ignore lint/suspicious/noExplicitAny: mock db
    const result = await runDeprovisioningStep(db as any, body);
    expect(result).toEqual({ ok: false, reason: 'max-attempts' });
    expect(suspendAccount).not.toHaveBeenCalled();
    expect(recomputeRunStatus).toHaveBeenCalled();
    void update;
  });

  it('inserts provenance BEFORE calling the adapter', async () => {
    const { db } = makeDb({
      id: 's-1',
      runId: 'run-1',
      status: 'PENDING',
      attempts: 0,
      organizationId: 'org-1',
    });
    // biome-ignore lint/suspicious/noExplicitAny: mock db
    await runDeprovisioningStep(db as any, body);
    expect(callOrder).toEqual(['provenance', 'adapter']);
  });

  it('persists errorClass + SHA hashes onto the step', async () => {
    suspendAccount.mockResolvedValueOnce({
      status: 'FAILED',
      errorClass: 'PERMANENT_FORBIDDEN',
      requestSha256: 'a'.repeat(64),
      responseSha256: 'b'.repeat(64),
    });
    const { db, update } = makeDb({
      id: 's-1',
      runId: 'run-1',
      status: 'PENDING',
      attempts: 0,
      organizationId: 'org-1',
    });
    // biome-ignore lint/suspicious/noExplicitAny: mock db
    await runDeprovisioningStep(db as any, body);
    const resultUpdate = update.mock.calls.find(
      // biome-ignore lint/suspicious/noExplicitAny: inspecting mock args
      (c: any[]) => c[0]?.data?.requestSha256 !== undefined,
    );
    expect(resultUpdate?.[0].data.status).toBe('FAILED');
    expect(resultUpdate?.[0].data.errorClass).toBe('PERMANENT_FORBIDDEN');
  });

  it('maps LIKELY_GONE to a SUCCEEDED step (D-06)', async () => {
    suspendAccount.mockResolvedValueOnce({
      status: 'LIKELY_GONE',
      reason: 'user_not_found',
      errorClass: 'PERMANENT_NOT_FOUND',
      requestSha256: 'c'.repeat(64),
      responseSha256: 'd'.repeat(64),
    });
    const { db, update } = makeDb({
      id: 's-1',
      runId: 'run-1',
      status: 'PENDING',
      attempts: 0,
      organizationId: 'org-1',
    });
    // biome-ignore lint/suspicious/noExplicitAny: mock db
    const result = await runDeprovisioningStep(db as any, body);
    expect(result.ok).toBe(true);
    const resultUpdate = update.mock.calls.find(
      // biome-ignore lint/suspicious/noExplicitAny: inspecting mock args
      (c: any[]) => c[0]?.data?.requestSha256 !== undefined,
    );
    expect(resultUpdate?.[0].data.status).toBe('SUCCEEDED');
  });

  it('emits 2 sub-action audit rows for a GWS revokeAllSessions (3-row mapping)', async () => {
    const { db } = makeDb({
      id: 's-1',
      runId: 'run-1',
      status: 'PENDING',
      attempts: 0,
      organizationId: 'org-1',
    });
    await runDeprovisioningStep(
      // biome-ignore lint/suspicious/noExplicitAny: mock db
      db as any,
      { ...body, stepKind: 'REVOKE_ALL_SESSIONS' as const },
    );
    const subActionCalls = auditInfo.mock.calls.filter(
      // biome-ignore lint/suspicious/noExplicitAny: inspecting mock args
      (c: any[]) => c[0]?.auditEvent === 'deprovision_step_subaction',
    );
    expect(subActionCalls).toHaveLength(2);
    expect(revokeAllSessions).toHaveBeenCalled();
  });

  it('calls recomputeRunStatus after the step transition', async () => {
    const { db } = makeDb({
      id: 's-1',
      runId: 'run-1',
      status: 'PENDING',
      attempts: 0,
      organizationId: 'org-1',
    });
    // biome-ignore lint/suspicious/noExplicitAny: mock db
    await runDeprovisioningStep(db as any, body);
    expect(recomputeRunStatus).toHaveBeenCalledWith(db, 'run-1');
  });

  it('throws a clear error when the token resolver returns not-ok (not connected) — fail-fast (78-WR-3)', async () => {
    const { resolveDeprovisionToken } = await import('../services/idp-token-resolver');
    (resolveDeprovisionToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      reason: 'not_connected',
    });
    const { db } = makeDb({
      id: 's-1',
      runId: 'run-1',
      status: 'PENDING',
      attempts: 0,
      organizationId: 'org-1',
    });
    // biome-ignore lint/suspicious/noExplicitAny: mock db
    await expect(runDeprovisioningStep(db as any, body)).rejects.toThrow(
      /GOOGLE_WORKSPACE is not connected/,
    );
    expect(suspendAccount).not.toHaveBeenCalled();
  });

  it('throws a clear error for a provider with no resolver wired (ENTRA/OKTA/GITHUB) — fail-fast (78-WR-3)', async () => {
    const { db } = makeDb({
      id: 's-1',
      runId: 'run-1',
      status: 'PENDING',
      attempts: 0,
      organizationId: 'org-1',
    });
    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: mock db
      runDeprovisioningStep(db as any, { ...body, provider: 'ENTRA' as const }),
    ).rejects.toThrow(/no credential resolver registered for provider ENTRA/);
    expect(suspendAccount).not.toHaveBeenCalled();
  });

  it('throws StepOrgMismatchError when step organizationId does not match payload — defense-in-depth (77 WR-04)', async () => {
    const { db } = makeDb({
      id: 's-1',
      runId: 'run-1',
      status: 'PENDING',
      attempts: 0,
      organizationId: 'org-OTHER',
    });
    // biome-ignore lint/suspicious/noExplicitAny: mock db
    await expect(runDeprovisioningStep(db as any, body)).rejects.toThrow(StepOrgMismatchError);
    expect(suspendAccount).not.toHaveBeenCalled();
  });

  it('throws StepOrgMismatchError when the step does not exist — defense-in-depth (77 WR-04)', async () => {
    const { db } = makeDb(null);
    // biome-ignore lint/suspicious/noExplicitAny: mock db
    await expect(runDeprovisioningStep(db as any, body)).rejects.toThrow(StepOrgMismatchError);
    expect(suspendAccount).not.toHaveBeenCalled();
  });
});

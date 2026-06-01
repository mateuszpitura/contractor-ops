import type { createTenantClientFrom, PrismaClient } from '@contractor-ops/db';
import { insertProvenance, MAX_ATTEMPTS, recomputeRunStatus } from '@contractor-ops/idp-saga';
import { getDeprovisionableAdapter } from '@contractor-ops/integrations';
import { GoogleWorkspaceAdapter } from '@contractor-ops/integrations/adapters/google-workspace-adapter';
import { SlackAdapter } from '@contractor-ops/integrations/adapters/slack-adapter';
import { getIdpAuditLogger, hashExternalUserId } from '@contractor-ops/logger';
import { z } from 'zod';
import { DEPROVISIONING_TOGGLE_PROVIDERS } from '../routers/integrations/deprovisioning.js';
import { resolveDeprovisionToken } from './idp-token-resolver.js';

/**
 * The region-aware tenant-scoped Prisma client passed by the QStash route. It is a
 * structural superset of the model accessors the idp-saga helpers use; the helpers are
 * typed against the base `PrismaClient`, so we cast at those call boundaries (the runtime
 * client is identical — trusted internal client, not external input).
 */
type TenantDb = ReturnType<typeof createTenantClientFrom>;

const auditLog = getIdpAuditLogger();

export const stepRunnerBodySchema = z.object({
  runId: z.string().min(1),
  stepId: z.string().min(1),
  organizationId: z.string().min(1),
  provider: z.enum(DEPROVISIONING_TOGGLE_PROVIDERS),
  stepKind: z.enum(['SUSPEND_ACCOUNT', 'REVOKE_ALL_SESSIONS']),
  externalUserId: z.string().min(1),
});

export type StepRunnerBody = z.infer<typeof stepRunnerBodySchema>;

export interface StepRunnerResult {
  ok: boolean;
  reason?: string;
}

/**
 * Thrown when the step's own organizationId does not match the one in the
 * QStash payload (77 WR-04 defense-in-depth). Non-retryable — the caller
 * (QStash route) should return 400, not 500, so the job is not retried.
 */
export class StepOrgMismatchError extends Error {
  constructor(stepId: string, organizationId: string) {
    super(
      `IdP step org-mismatch: step ${stepId} does not belong to organization ${organizationId}`,
    );
    this.name = 'StepOrgMismatchError';
  }
}

/**
 * Phase 76 D-03 — execute a single deprovisioning saga step.
 *
 * One independent QStash job per (provider, stepKind). NO Promise.allSettled
 * aggregation (Pitfall 10) — the aggregate run status is derived by
 * recomputeRunStatus after every transition (D-02).
 *
 * Order of operations (the audit + idempotency contract):
 *   1. Read step; short-circuit to FAILED if attempts >= MAX_ATTEMPTS.
 *   2. Mark IN_PROGRESS + increment attempts.
 *   3. INSERT IdpChangeProvenance BEFORE the adapter call (D-09 self-trigger filter).
 *   4. Resolve the Deprovisionable adapter + invoke suspend/revoke.
 *   5. Map USER_NOT_FOUND → SUCCEEDED (idempotent provider semantics).
 *   6. Persist result (status, SHA-256 hashes, sanitised error, finishedAt).
 *   7. Emit a single audit-log entry.
 *   8. recomputeRunStatus(runId) — single source of truth for the run status.
 */
export async function runDeprovisioningStep(
  db: TenantDb,
  body: StepRunnerBody,
): Promise<StepRunnerResult> {
  // idp-saga helpers are typed against the base PrismaClient; the tenant client is a
  // structural superset of the model accessors they use.
  const sagaDb = db as unknown as PrismaClient;
  const step = await db.deprovisioningStep.findUnique({
    where: { id: body.stepId },
    select: { id: true, runId: true, status: true, attempts: true, organizationId: true },
  });

  // Defense-in-depth org-match guard (77 WR-04): the QStash payload is HMAC-signed
  // so this is trusted-internal input — but if organizationId ever mismatches the
  // step's own tenant, the runner would operate under the wrong regional client.
  // A mismatch is a non-retryable configuration error, not a transient failure.
  if (!step || step.organizationId !== body.organizationId) {
    throw new StepOrgMismatchError(body.stepId, body.organizationId);
  }

  if (step.attempts >= MAX_ATTEMPTS) {
    await db.deprovisioningStep.update({
      where: { id: step.id },
      data: { status: 'FAILED', finishedAt: new Date(), lastErrorMessage: 'MAX_ATTEMPTS exceeded' },
    });
    await recomputeRunStatus(sagaDb, step.runId);
    return { ok: false, reason: 'max-attempts' };
  }

  await db.deprovisioningStep.update({
    where: { id: step.id },
    data: {
      status: 'IN_PROGRESS',
      attempts: { increment: 1 },
      startedAt: step.attempts === 0 ? new Date() : undefined,
    },
  });

  // D-09 — provenance row inserted BEFORE the adapter call so the webhook
  // self-trigger filter can match our own change.
  await insertProvenance(sagaDb, {
    organizationId: body.organizationId,
    provider: body.provider,
    externalUserId: body.externalUserId,
    actionKind: body.stepKind === 'SUSPEND_ACCOUNT' ? 'SUSPEND' : 'REVOKE_SESSION',
    deprovisioningStepId: step.id,
  });

  // Resolve + configure the provider connection token before the adapter call
  // (GWS connection token, or the SLACK_ORG_GRID token — never the workspace token).
  const adapter = await resolveAdapter(sagaDb, body);

  // Adapters re-throw on TRANSIENT_* failures so the QStash route returns 500 and the
  // job is retried; the head-of-job MAX_ATTEMPTS guard caps total attempts.
  const result =
    body.stepKind === 'SUSPEND_ACCOUNT'
      ? await adapter.suspendAccount(body.externalUserId)
      : await adapter.revokeAllSessions(body.externalUserId);

  // Phase 77 D-06/D-11 — LIKELY_GONE (user already absent) + SUCCEEDED are
  // success-equivalent; USER_NOT_FOUND failureKind kept for back-compat.
  const finalStatus =
    result.status === 'SUCCEEDED' ||
    result.status === 'LIKELY_GONE' ||
    result.failureKind === 'USER_NOT_FOUND'
      ? 'SUCCEEDED'
      : 'FAILED';

  await db.deprovisioningStep.update({
    where: { id: step.id },
    data: {
      status: finalStatus,
      errorClass: result.errorClass ?? null,
      finishedAt: new Date(),
      requestSha256: result.requestSha256,
      responseSha256: result.responseSha256,
      lastErrorMessage: result.errorMessage ? result.errorMessage.slice(0, 1024) : null,
    },
  });

  // D-05 three-audit-row mapping: a GWS revokeAllSessions returns two sub-action
  // hash pairs (OAuth-grant revoke + sign-out). Emit each as its own audit row so a
  // full GWS run produces three rows (suspend + 2 revoke sub-actions).
  for (const sub of result.subActions ?? []) {
    auditLog.info(
      {
        auditEvent: 'deprovision_step_subaction',
        organizationId: body.organizationId,
        runId: body.runId,
        stepId: body.stepId,
        stepKind: body.stepKind,
        provider: body.provider,
        externalUserId: hashExternalUserId(body.externalUserId),
        actionResult: finalStatus,
        requestSha256: sub.requestSha256,
        responseSha256: sub.responseSha256,
      },
      `Deprovisioning sub-action ${sub.kind}`,
    );
  }

  auditLog.info(
    {
      auditEvent: 'deprovision_step_completed',
      organizationId: body.organizationId,
      runId: body.runId,
      stepId: body.stepId,
      stepKind: body.stepKind,
      provider: body.provider,
      externalUserId: hashExternalUserId(body.externalUserId),
      actionResult: finalStatus,
      attempts: step.attempts + 1,
      requestSha256: result.requestSha256,
      responseSha256: result.responseSha256,
      failureKind: result.failureKind,
      errorClass: result.errorClass,
    },
    'Deprovisioning step completed',
  );

  await recomputeRunStatus(sagaDb, step.runId);
  return { ok: finalStatus === 'SUCCEEDED' };
}

/**
 * Resolves the Deprovisionable adapter for a step, configured with the decrypted
 * connection token.
 *
 * Fail-fast: if the provider has no token resolver wired up yet (ENTRA / OKTA /
 * GITHUB are deprovisioning-deferred), throw immediately rather than returning a
 * bare registry instance with empty credentials. An uncredentialed adapter call
 * would silently fire real provider mutations with an empty bearer token, 401 into
 * PERMANENT_AUTH_EXPIRED, and look like a provider rejection rather than a
 * configuration gap.
 */
async function resolveAdapter(db: PrismaClient, body: StepRunnerBody) {
  if (body.provider === 'GOOGLE_WORKSPACE' || body.provider === 'SLACK') {
    const token = await resolveDeprovisionToken(db, body.organizationId, body.provider);
    if (token.ok) {
      return body.provider === 'GOOGLE_WORKSPACE'
        ? new GoogleWorkspaceAdapter().withAccessToken(token.accessToken)
        : new SlackAdapter().withOrgGridToken(token.accessToken);
    }
    // Token resolver returned not-ok (not connected / decrypt failure) for a
    // known provider — throw so the step records a clear not-connected failure
    // rather than falling through to the uncredentialed registry adapter.
    throw new Error(
      `IdP step resolver: provider ${body.provider} is not connected (reason: ${(token as { reason?: string }).reason ?? 'unknown'})`,
    );
  }
  // ENTRA / OKTA / GITHUB: no token resolver is wired — fail closed instead of
  // returning a bare adapter with empty credentials on a security-critical path.
  throw new Error(
    `IdP step resolver: no credential resolver registered for provider ${body.provider}. Add a resolver before enabling this provider for deprovisioning runs.`,
  );
}

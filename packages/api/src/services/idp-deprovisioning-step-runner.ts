import type { createTenantClientFrom, PrismaClient } from '@contractor-ops/db';
import { insertProvenance, MAX_ATTEMPTS, recomputeRunStatus } from '@contractor-ops/idp-saga';
import { getDeprovisionableAdapter } from '@contractor-ops/integrations';
import { getIdpAuditLogger } from '@contractor-ops/logger';
import { z } from 'zod';

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
  provider: z.enum(['GOOGLE_WORKSPACE', 'SLACK', 'ENTRA', 'OKTA', 'GITHUB']),
  stepKind: z.enum(['SUSPEND_ACCOUNT', 'REVOKE_ALL_SESSIONS']),
  externalUserId: z.string().min(1),
});

export type StepRunnerBody = z.infer<typeof stepRunnerBodySchema>;

export interface StepRunnerResult {
  ok: boolean;
  reason?: string;
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
  const step = await db.deprovisioningStep.findUniqueOrThrow({
    where: { id: body.stepId },
    select: { id: true, runId: true, status: true, attempts: true },
  });

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

  const adapter = getDeprovisionableAdapter(body.provider);
  const result =
    body.stepKind === 'SUSPEND_ACCOUNT'
      ? await adapter.suspendAccount(body.externalUserId)
      : await adapter.revokeAllSessions(body.externalUserId);

  // USER_NOT_FOUND → success-equivalent (goal state met).
  const finalStatus =
    result.status === 'SUCCEEDED' || result.failureKind === 'USER_NOT_FOUND'
      ? 'SUCCEEDED'
      : 'FAILED';

  await db.deprovisioningStep.update({
    where: { id: step.id },
    data: {
      status: finalStatus,
      finishedAt: new Date(),
      requestSha256: result.requestSha256,
      responseSha256: result.responseSha256,
      lastErrorMessage: result.errorMessage ? result.errorMessage.slice(0, 1024) : null,
    },
  });

  auditLog.info(
    {
      auditEvent: 'deprovision_step_completed',
      organizationId: body.organizationId,
      runId: body.runId,
      stepId: body.stepId,
      stepKind: body.stepKind,
      provider: body.provider,
      externalUserId: body.externalUserId,
      actionResult: finalStatus,
      attempts: step.attempts + 1,
      requestSha256: result.requestSha256,
      responseSha256: result.responseSha256,
      failureKind: result.failureKind,
    },
    'Deprovisioning step completed',
  );

  await recomputeRunStatus(sagaDb, step.runId);
  return { ok: finalStatus === 'SUCCEEDED' };
}

import type { PrismaClient } from '@contractor-ops/db';
import type { RunStatus, StepRow } from './types';
import { MAX_ATTEMPTS } from './types';

/**
 * Phase 76 D-02 — Aggregate run-status derivation rule.
 *
 * PURE function. Rule:
 *   - all steps SUCCEEDED → COMPLETED
 *   - all steps FAILED at MAX_ATTEMPTS → FAILED
 *   - any step terminally FAILED + any step SUCCEEDED → PARTIAL_FAILURE (admin reconcile queue)
 *   - empty step list → PENDING (transient — pre-fan-out)
 *   - otherwise → IN_PROGRESS
 *
 * "Terminally failed" = status === 'FAILED' AND attempts >= MAX_ATTEMPTS.
 * A FAILED step with attempts < MAX is still retryable; the run stays IN_PROGRESS.
 */
export function deriveRunStatus(steps: readonly StepRow[]): RunStatus {
  if (steps.length === 0) return 'PENDING';

  const allSucceeded = steps.every(s => s.status === 'SUCCEEDED');
  if (allSucceeded) return 'COMPLETED';

  const allTerminalFailure = steps.every(s => s.status === 'FAILED' && s.attempts >= MAX_ATTEMPTS);
  if (allTerminalFailure) return 'FAILED';

  const anyTerminalFailure = steps.some(s => s.status === 'FAILED' && s.attempts >= MAX_ATTEMPTS);
  const anySucceeded = steps.some(s => s.status === 'SUCCEEDED');
  if (anyTerminalFailure && anySucceeded) return 'PARTIAL_FAILURE';

  return 'IN_PROGRESS';
}

/**
 * Async wrapper: reads the run's steps, derives the new status, UPDATEs the run row.
 * Called by the QStash step-runner job AFTER every step transition (Plan 76-06).
 *
 * Returns the new status. Idempotent — safe to call concurrently (last write wins;
 * all writes converge because deriveRunStatus is pure-of-the-step-rows).
 */
export async function recomputeRunStatus(db: PrismaClient, runId: string): Promise<RunStatus> {
  const steps = await db.deprovisioningStep.findMany({
    where: { runId },
    select: { status: true, attempts: true },
  });
  const newStatus = deriveRunStatus(steps);
  const finishedAt =
    newStatus === 'COMPLETED' || newStatus === 'PARTIAL_FAILURE' || newStatus === 'FAILED'
      ? new Date()
      : null;
  await db.deprovisioningRun.update({
    where: { id: runId },
    data: { status: newStatus, finishedAt },
  });
  return newStatus;
}

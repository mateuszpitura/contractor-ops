import type { PrismaClient } from '@contractor-ops/db';
import type { RunStatus, StepRow } from './types.js';
import { MAX_ATTEMPTS } from './types.js';

/**
 * Phase 76 D-02 / Phase 77 D-11 — Aggregate run-status derivation rule.
 *
 * PURE function. Rule:
 *   - all steps terminal-success → COMPLETED
 *   - all steps FAILED at MAX_ATTEMPTS → FAILED
 *   - any step terminally FAILED + any step terminal-success → PARTIAL_FAILURE (admin reconcile queue)
 *   - empty step list → PENDING (transient — pre-fan-out)
 *   - otherwise → IN_PROGRESS
 *
 * "Terminal-success" = `SUCCEEDED` OR `MANUAL_COMPLETED` (Phase 77 D-11 — an
 * admin manually-completed step is done by out-of-band verification, so it
 * counts toward COMPLETED/PARTIAL_FAILURE exactly like SUCCEEDED).
 * "Terminally failed" = status === 'FAILED' AND attempts >= MAX_ATTEMPTS.
 * A FAILED step with attempts < MAX is still retryable; the run stays IN_PROGRESS.
 */
function isTerminalSuccess(status: StepRow['status']): boolean {
  return status === 'SUCCEEDED' || status === 'MANUAL_COMPLETED';
}

export function deriveRunStatus(steps: readonly StepRow[]): RunStatus {
  if (steps.length === 0) return 'PENDING';

  const allSucceeded = steps.every(s => isTerminalSuccess(s.status));
  if (allSucceeded) return 'COMPLETED';

  const allTerminalFailure = steps.every(s => s.status === 'FAILED' && s.attempts >= MAX_ATTEMPTS);
  if (allTerminalFailure) return 'FAILED';

  const anyTerminalFailure = steps.some(s => s.status === 'FAILED' && s.attempts >= MAX_ATTEMPTS);
  const anySucceeded = steps.some(s => isTerminalSuccess(s.status));
  if (anyTerminalFailure && anySucceeded) return 'PARTIAL_FAILURE';

  return 'IN_PROGRESS';
}

/**
 * Async wrapper: reads the run's steps, derives the new status, UPDATEs the run row.
 * Called by the QStash step-runner job AFTER every step transition (Plan 76-06).
 *
 * Returns the new status. Idempotent — safe to call concurrently (last write wins;
 * all writes converge because deriveRunStatus is pure-of-the-step-rows).
 *
 * `finishedAt` is set-once: if the run already has a finishedAt (a late concurrent
 * re-derivation that still sees a terminal aggregate), the existing timestamp is
 * preserved so it can serve as SLA evidence without jitter.
 */
export async function recomputeRunStatus(db: PrismaClient, runId: string): Promise<RunStatus> {
  const [steps, run] = await Promise.all([
    db.deprovisioningStep.findMany({
      where: { runId },
      select: { status: true, attempts: true },
    }),
    db.deprovisioningRun.findUnique({
      where: { id: runId },
      select: { finishedAt: true },
    }),
  ]);
  const newStatus = deriveRunStatus(steps);
  const isTerminal =
    newStatus === 'COMPLETED' || newStatus === 'PARTIAL_FAILURE' || newStatus === 'FAILED';
  // Preserve an already-set finishedAt — do not overwrite with a later timestamp.
  const finishedAt = isTerminal ? (run?.finishedAt ?? new Date()) : null;
  await db.deprovisioningRun.update({
    where: { id: runId },
    data: { status: newStatus, finishedAt },
  });
  return newStatus;
}

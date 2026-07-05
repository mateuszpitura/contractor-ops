/**
 * Working-time-limit daily scan — reminders cron sub-job.
 *
 * Detects rolling weekly-average 48h breaches per jurisdiction across every data
 * region and dispatches one digest per recipient/day. The business logic
 * (runWtLimitScan) uses its OWN regional clients — NOT the reminders
 * lock-holding transaction — so a scan crash is isolated from the other reminder
 * sub-jobs and the dedup unique index is the real idempotency guard.
 */

import { runWtLimitScan } from '@contractor-ops/api/services/cron-jobs';
import { createCronLogger } from '@contractor-ops/logger';

const log = createCronLogger('wt-limit-scan');

export type WtLimitScanResult = Awaited<ReturnType<typeof runWtLimitScan>>;

/** Shared entry for the reminders fan-out. Never rejects — a failure returns
 * zero counts so it cannot abort the sibling reminder sub-jobs. */
export async function executeWtLimitScan(): Promise<WtLimitScanResult> {
  try {
    return await runWtLimitScan();
  } catch (err) {
    log.error({ err }, 'wt-limit-scan failed (isolated — returning zero counts)');
    return { scanned: 0, breaches: 0, digests: 0 };
  }
}

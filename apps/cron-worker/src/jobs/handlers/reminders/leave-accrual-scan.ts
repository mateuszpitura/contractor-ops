/**
 * Leave accrual daily scan — reminders cron sub-job.
 *
 * Accrues annual entitlement and (on 1 Jan) year-end carryover for every active
 * employee. Uses its own regional clients — NOT the reminders lock-holding tx.
 */

import { runLeaveAccrualScan } from '@contractor-ops/api/services/cron-jobs';
import { createCronLogger } from '@contractor-ops/logger';

const log = createCronLogger('leave-accrual-scan');

export type LeaveAccrualScanResult = Awaited<ReturnType<typeof runLeaveAccrualScan>>;

export async function executeLeaveAccrualScan(): Promise<LeaveAccrualScanResult> {
  try {
    return await runLeaveAccrualScan();
  } catch (err) {
    log.error({ err }, 'leave-accrual-scan failed (isolated — returning zero counts)');
    return { workers: 0, accrued: 0, carryovers: 0 };
  }
}

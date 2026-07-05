/**
 * Compliance reminder scan — shared entry point.
 *
 * Business logic lives in `@contractor-ops/api/services/cron-jobs`. The scan is
 * driven by the reminders fan-out (`reminders/index.ts`); this module only
 * exposes the shared entry it calls.
 */

import { runComplianceReminderScan } from '@contractor-ops/api/services/cron-jobs';

export type ComplianceReminderScanResult = Awaited<ReturnType<typeof runComplianceReminderScan>>;

/** Shared entry for the reminders fan-out and standalone ticks. */
export async function executeComplianceReminderScan(): Promise<ComplianceReminderScanResult> {
  return runComplianceReminderScan();
}

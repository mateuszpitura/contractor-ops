/**
 * Compliance reminder scan — thin cron handler.
 *
 * Business logic lives in `@contractor-ops/api/services/cron-jobs`.
 * This handler only orchestrates logging, metrics, and error surfacing.
 */

import { runComplianceReminderScan } from '@contractor-ops/api/services/cron-jobs';
import { metrics } from '@contractor-ops/logger/metrics';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

export type ComplianceReminderScanResult = Awaited<ReturnType<typeof runComplianceReminderScan>>;

/** Shared entry for the reminders fan-out and standalone ticks. */
export async function executeComplianceReminderScan(): Promise<ComplianceReminderScanResult> {
  return runComplianceReminderScan();
}

export const complianceReminderHandler: JobHandler = async ctx => {
  const start = performance.now();
  try {
    const result = await executeComplianceReminderScan();
    ctx.log.info(result, 'compliance-reminder scan completed');
    metrics.gauge('cron.compliance_reminder.fires', result.fires);
    metrics.gauge('cron.compliance_reminder.digests', result.digests);
    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: { fires: result.fires, digests: result.digests },
    };
  } catch (err) {
    ctx.log.error({ err }, 'compliance-reminder scan failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'compliance-reminder' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};

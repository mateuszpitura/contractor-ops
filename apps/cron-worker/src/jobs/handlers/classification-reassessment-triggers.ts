/**
 * Classification reassessment-trigger scan handler.
 *
 * Daily AuditLog-driven scan that detects material-change events on
 * contractors / engagements and emits ReassessmentTrigger rows.
 * Short-circuits when `module.classification-engine` is off.
 */

import { runReassessmentTriggerScan } from '@contractor-ops/api/services/reassessment-trigger-scan';
import { evaluate } from '@contractor-ops/feature-flags';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

const FLAG_CTX = {
  organizationId: 'CRON',
  region: 'EU', // jurisdiction='ANY' — region doesn't affect evaluation
} as const;

export const classificationReassessmentTriggersHandler: JobHandler = async ctx => {
  const start = performance.now();

  const flagResult = evaluate('module.classification-engine', FLAG_CTX);
  if (!flagResult.enabled) {
    ctx.log.info(
      {
        event: 'CRON_SKIPPED_FLAG_OFF',
        endpoint: 'classification-reassessment-triggers',
      },
      'classification-reassessment-triggers cron skipped: flag disabled',
    );
    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: { skipped: true, reason: 'FLAG_OFF' },
    };
  }

  try {
    const result = await runReassessmentTriggerScan();
    ctx.log.info(result, 'classification-reassessment-triggers cron completed');
    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: { ...result },
    };
  } catch (err) {
    ctx.log.error({ err }, 'classification-reassessment-triggers cron failed');
    Sentry.captureException(err, {
      tags: { 'cron.job': 'classification-reassessment-triggers' },
    });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};

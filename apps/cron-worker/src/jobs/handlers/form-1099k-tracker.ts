/**
 * Informational 1099-K threshold tracker cron handler.
 *
 * Runs `runForm1099KTrackerScan` on a daily cadence: sums each US contractor's
 * cumulative tax-year USD payouts + transaction count and transitions the
 * informational band (SAFE → APPROACHING → OVER). Ships dark behind
 * `module.us-expansion`; short-circuits when the flag is off. Purely
 * informational — it never files a 1099-K.
 */

import { runForm1099KTrackerScan } from '@contractor-ops/api/services/form-1099k-tracker.service';
import { evaluate } from '@contractor-ops/feature-flags';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

const FLAG_CTX = {
  organizationId: 'CRON',
  region: 'EU',
} as const;

export const form1099kTrackerHandler: JobHandler = async ctx => {
  const start = performance.now();

  const flagResult = evaluate('module.us-expansion', FLAG_CTX);
  if (!flagResult.enabled) {
    ctx.log.info(
      {
        event: 'CRON_SKIPPED_FLAG_OFF',
        endpoint: 'form-1099k-tracker',
      },
      'form-1099k-tracker cron skipped: flag disabled',
    );
    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: { skipped: true, reason: 'FLAG_OFF' },
    };
  }

  try {
    const result = await runForm1099KTrackerScan();
    ctx.log.info(result, 'form-1099k-tracker cron completed');
    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: { ...result },
    };
  } catch (err) {
    ctx.log.error({ err }, 'form-1099k-tracker cron failed');
    Sentry.captureException(err, {
      tags: { 'cron.job': 'form-1099k-tracker' },
    });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};

/**
 * Year-end 1099-NEC batch-due reminder cron handler.
 *
 * Runs `runYearEnd1099ReminderScan` in the January filing window: it reminds
 * each org's staff that the closing tax year's 1099-NEC batch is due. NOTIFY-ONLY
 * — it never aggregates a batch, builds IRIS XML, renders a Copy-B, or transmits
 * (generation and filing are separate, deliberate, human-initiated actions).
 * Ships dark behind `module.us-expansion`; short-circuits when the flag is off.
 */

import { runYearEnd1099ReminderScan } from '@contractor-ops/api/services/year-end-1099-reminder.service';
import { evaluate } from '@contractor-ops/feature-flags';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

const FLAG_CTX = {
  organizationId: 'CRON',
  region: 'EU',
} as const;

export const yearEnd1099ReminderHandler: JobHandler = async ctx => {
  const start = performance.now();

  const flagResult = evaluate('module.us-expansion', FLAG_CTX);
  if (!flagResult.enabled) {
    ctx.log.info(
      { event: 'CRON_SKIPPED_FLAG_OFF', endpoint: 'year-end-1099-reminder' },
      'year-end-1099-reminder cron skipped: flag disabled',
    );
    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: { skipped: true, reason: 'FLAG_OFF' },
    };
  }

  try {
    const result = await runYearEnd1099ReminderScan();
    ctx.log.info(result, 'year-end-1099-reminder cron completed');
    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: { ...result },
    };
  } catch (err) {
    ctx.log.error({ err }, 'year-end-1099-reminder cron failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'year-end-1099-reminder' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};

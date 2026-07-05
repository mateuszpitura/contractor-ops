/**
 * ZATCA PENDING-submission reconcile.
 *
 * A ZATCA submission that failed transiently (network, timeout, 5xx) leaves its
 * `ZatcaInvoiceChain` row PENDING with `submittedAt` unset. QStash retries the
 * queued job a few times, but a longer outage can outlive those retries. This
 * cron is the backstop: it requeries ZATCA for any chain still PENDING past
 * `CRON_ZATCA_RECONCILE_STALE_MINUTES` and settles it. Resubmission reuses each
 * row's original zatcaUuid, so ZATCA treats it idempotently and an invoice it
 * quietly cleared during the outage simply settles.
 *
 * Idempotent: an already-settled chain is skipped inside the service, and a
 * resubmission that still fails leaves the row PENDING for the next tick.
 */

import { reconcilePendingZatcaChains } from '@contractor-ops/api/services/zatca-submission';
import { metrics } from '@contractor-ops/logger/metrics';
import { loadEnv } from '../../env.js';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

export const zatcaReconcileHandler: JobHandler = async ctx => {
  const start = performance.now();
  const olderThanMinutes = loadEnv().CRON_ZATCA_RECONCILE_STALE_MINUTES;

  try {
    const result = await reconcilePendingZatcaChains({ olderThanMinutes });
    ctx.log.info(result, 'zatca-reconcile tick complete');
    metrics.gauge('cron.zatca_reconcile.scanned', result.scanned);
    metrics.gauge('cron.zatca_reconcile.settled', result.settled);
    metrics.gauge('cron.zatca_reconcile.failed', result.failed);

    return {
      ok: result.failed === 0,
      durationMs: Math.round(performance.now() - start),
      details: { ...result } as Record<string, unknown>,
    };
  } catch (err) {
    ctx.log.error({ err }, 'zatca-reconcile tick failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'zatca-reconcile' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};

/**
 * Peppol outbound missing-enqueue reconcile.
 *
 * The post-approval Peppol enqueue is fire-and-forget: a QStash publish failure
 * (or a message lost after publish) leaves an approved UAE invoice with Peppol
 * identifiers but no OUTBOUND transmission row — nothing would ever submit it.
 * This cron is the backstop: it re-enqueues `peppol.outbound` for post-approval
 * invoices on Peppol-connected orgs with no in-flight/delivered transmission.
 *
 * Idempotent: delegates to `maybeEnqueuePeppolOutbound`, which re-checks org
 * country, participant and in-flight state, and dedups the QStash job per invoice.
 */

import { reconcileMissingPeppolOutboundEnqueues } from '@contractor-ops/api/services/einvoice-submission-triggers';
import { metrics } from '@contractor-ops/logger/metrics';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

export const peppolReconcileHandler: JobHandler = async ctx => {
  const start = performance.now();

  try {
    const result = await reconcileMissingPeppolOutboundEnqueues();
    ctx.log.info({ ...result }, 'peppol-reconcile tick complete');
    metrics.gauge('cron.peppol_reconcile.scanned', result.scanned);
    metrics.gauge('cron.peppol_reconcile.enqueued', result.enqueued);
    metrics.gauge('cron.peppol_reconcile.failed', result.failed);

    return {
      ok: result.failed === 0,
      durationMs: Math.round(performance.now() - start),
      details: { ...result } as Record<string, unknown>,
    };
  } catch (err) {
    ctx.log.error({ err }, 'peppol-reconcile tick failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'peppol-reconcile' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};

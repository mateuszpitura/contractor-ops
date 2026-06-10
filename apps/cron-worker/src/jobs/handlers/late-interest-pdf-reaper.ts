/**
 * Late-payment claim PDF reaper.
 *
 * Every 5 minutes, scans for `InvoiceInterestClaim` rows stuck in
 * `pdfStatus = PENDING_RENDER` (or RENDERING > STALE_AFTER_MS):
 *
 *   1. Rows that already have a `pdfKey` predate the async-PDF migration;
 *      flip them to READY without a re-render.
 *   2. RENDERING-stuck rows had a worker win the CAS then crash — revert
 *      to PENDING_RENDER so the next worker can re-claim.
 *   3. Re-publish to QStash with `deduplicationId = late-interest-pdf-{id}`
 *      so two reaper ticks within the 24h dedup window collapse to one.
 *      (QStash rejects deduplicationId values containing ':').
 *
 * Idempotent: rows already flipped to READY/FAILED are excluded by the
 * scan predicate.
 */

import { prisma } from '@contractor-ops/db';
import { getQStashClient } from '@contractor-ops/integrations/services/qstash-client';
import { metrics } from '@contractor-ops/logger/metrics';
import { getServerEnv } from '@contractor-ops/validators';
import { loadEnv } from '../../env.js';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

const STALE_AFTER_MS = 10 * 60 * 1_000;
const BATCH_LIMIT = 100;

interface ReaperResult {
  scanned: number;
  backfilled: number;
  requeued: number;
  requeueFailed: number;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: per-row branching (backfill vs RENDERING revert vs re-enqueue) reads top-to-bottom; splitting would obscure the predicate matrix
async function runReaper(log: Parameters<JobHandler>[0]['log']): Promise<ReaperResult> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);

  const stuck = await prisma.invoiceInterestClaim.findMany({
    where: {
      pdfStatus: { in: ['PENDING_RENDER', 'RENDERING'] },
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      organizationId: true,
      pdfStatus: true,
      pdfKey: true,
      claimedAt: true,
    },
    take: BATCH_LIMIT,
    orderBy: { createdAt: 'asc' },
  });

  if (stuck.length === 0) {
    return { scanned: 0, backfilled: 0, requeued: 0, requeueFailed: 0 };
  }

  let backfilled = 0;
  let requeued = 0;
  let requeueFailed = 0;

  // Continue posting to the legacy host until cutover (Step 16). The
  // QStash payload only carries the claim id; once `API_URL` ends up on
  // the new Fastify host, this URL flips automatically.
  const baseUrl = loadEnv().API_URL ?? getServerEnv().PUBLIC_APP_URL ?? '';
  const qstashUrl = `${baseUrl}/late-interest/_render-claim-pdf`;

  for (const row of stuck) {
    if (row.pdfKey) {
      // Case 1: row predates the async-PDF migration — PDF on R2,
      // just flip the status bit.
      await prisma.invoiceInterestClaim.update({
        where: { id: row.id },
        data: { pdfStatus: 'READY', pdfReadyAt: row.claimedAt },
      });
      backfilled += 1;
      continue;
    }

    if (row.pdfStatus === 'RENDERING') {
      await prisma.invoiceInterestClaim.updateMany({
        where: { id: row.id, pdfStatus: 'RENDERING' },
        data: { pdfStatus: 'PENDING_RENDER' },
      });
    }

    try {
      await getQStashClient().publishJSON({
        url: qstashUrl,
        body: { claimId: row.id, organizationId: row.organizationId },
        retries: 3,
        timeout: '60s',
        deduplicationId: `late-interest-pdf-${row.id}`,
      });
      requeued += 1;
    } catch (err) {
      requeueFailed += 1;
      log.error(
        { err: err instanceof Error ? err.message : String(err), claimId: row.id },
        'failed to re-enqueue claim pdf render',
      );
    }
  }

  return { scanned: stuck.length, backfilled, requeued, requeueFailed };
}

export const lateInterestPdfReaperHandler: JobHandler = async ctx => {
  const start = performance.now();
  try {
    const result = await runReaper(ctx.log);
    ctx.log.info(result, 'pdf reaper tick complete');
    metrics.gauge('cron.late_interest_pdf_reaper.backfilled', result.backfilled);
    metrics.gauge('cron.late_interest_pdf_reaper.requeued', result.requeued);
    metrics.gauge('cron.late_interest_pdf_reaper.requeue_failed', result.requeueFailed);
    return {
      ok: result.requeueFailed === 0,
      durationMs: Math.round(performance.now() - start),
      details: { ...result } as Record<string, unknown>,
    };
  } catch (err) {
    ctx.log.error({ err }, 'pdf reaper tick failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'late-interest-pdf-reaper' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};

import { withCronMonitor } from '@contractor-ops/api/services/cron-monitor';
import { prisma } from '@contractor-ops/db';
import { getQStashClient } from '@contractor-ops/integrations/services/qstash-client';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import { getServerEnv } from '@contractor-ops/validators';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const log = createCronLogger('late-interest-pdf-reaper');

// How old a PENDING_RENDER row must be before the reaper touches it.
// Shorter than this and we race the in-flight QStash job on first delivery.
const STALE_AFTER_MS = 10 * 60 * 1_000;

// Cap per-tick to keep the cron bounded. If the queue is deeper than this,
// the next tick picks up the rest.
const BATCH_LIMIT = 100;

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token === cronSecret;
}

/**
 * Reaper for `InvoiceInterestClaim` rows stuck in `pdfStatus = PENDING_RENDER`.
 *
 * Two reasons a row lands here:
 *
 *   1. Post-deploy backfill. `db push` adds the `pdfStatus` column with its
 *      default (PENDING_RENDER) for every existing row, even those that
 *      already have a rendered `pdfKey`. For those, the correct action is
 *      to flip them to READY — no re-render needed.
 *
 *   2. A QStash delivery was lost, or the `claim` mutation enqueue call
 *      failed silently (Upstash outage), leaving the row durable but
 *      unrendered. For those, we re-enqueue.
 *
 * The reaper is idempotent. Multiple ticks on the same batch are safe —
 * rows that already flipped to READY/FAILED are skipped by the scan
 * predicate.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Sentry.withMonitor(
    'late-interest-pdf-reaper',
    () =>
      withCronMonitor('late-interest-pdf-reaper', async () => {
        try {
          const result = await runReaper();
          log.info(result, 'pdf reaper tick complete');
          metrics.gauge('cron.late_interest_pdf_reaper.backfilled', result.backfilled);
          metrics.gauge('cron.late_interest_pdf_reaper.requeued', result.requeued);
          metrics.gauge('cron.late_interest_pdf_reaper.requeue_failed', result.requeueFailed);
          return NextResponse.json(result);
        } catch (error) {
          log.error({ err: error }, 'pdf reaper tick failed');
          Sentry.captureException(error, {
            tags: { 'cron.job': 'late-interest-pdf-reaper' },
          });
          return NextResponse.json({ error: 'Reaper failed' }, { status: 500 });
        }
      }),
    {
      schedule: { type: 'crontab', value: '*/5 * * * *' },
      timezone: 'UTC',
    },
  );
}

interface ReaperResult {
  scanned: number;
  backfilled: number;
  requeued: number;
  requeueFailed: number;
}

async function runReaper(): Promise<ReaperResult> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);

  // F-ASYNC-15: scan PENDING_RENDER plus stale RENDERING rows. A row that
  // sits in RENDERING > STALE_AFTER_MS means the worker that won the CAS
  // crashed without flipping to READY/FAILED — re-enqueue is safe because
  // we'll attempt the CAS again from PENDING_RENDER (after we revert it).
  //
  // The RENDERING enum literal ships in the same migration as this code
  // (invoice.prisma F-ASYNC-15); cast keeps tsc green until generated
  // client is regenerated post-merge.
  const stuck = await prisma.invoiceInterestClaim.findMany({
    where: {
      // biome-ignore lint/suspicious/noExplicitAny: enum migration ships with this commit
      pdfStatus: { in: ['PENDING_RENDER', 'RENDERING' as any] },
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

  const qstashUrl = `${getServerEnv().NEXT_PUBLIC_APP_URL}/api/late-interest/_render-claim-pdf`;

  for (const row of stuck) {
    // Case 1: row was created before the async-PDF migration. The PDF is
    // already on R2; just flip the status bit.
    if (row.pdfKey) {
      await prisma.invoiceInterestClaim.update({
        where: { id: row.id },
        data: {
          pdfStatus: 'READY',
          pdfReadyAt: row.claimedAt,
        },
      });
      backfilled += 1;
      continue;
    }

    // Case 2: stuck row. F-ASYNC-15 — if the row is in RENDERING, the
    // worker that won the CAS crashed without finishing. Revert to
    // PENDING_RENDER first so the next worker can re-claim it via CAS.
    // For PENDING_RENDER rows, the QStash delivery never happened; just
    // re-enqueue.
    // biome-ignore lint/suspicious/noExplicitAny: enum migration ships with this commit
    if ((row.pdfStatus as any) === 'RENDERING') {
      await prisma.invoiceInterestClaim.updateMany({
        // biome-ignore lint/suspicious/noExplicitAny: enum migration ships with this commit
        where: { id: row.id, pdfStatus: 'RENDERING' as any },
        data: { pdfStatus: 'PENDING_RENDER' },
      });
    }

    try {
      await getQStashClient().publishJSON({
        url: qstashUrl,
        body: { claimId: row.id, organizationId: row.organizationId },
        retries: 3,
        timeout: '60s',
        // F-ASYNC-15 idempotency: use the claim id as QStash dedup ID so
        // two reaper ticks scheduling the same claim within the 24h dedup
        // window collapse to one delivery.
        deduplicationId: `late-interest-pdf:${row.id}`,
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

  return {
    scanned: stuck.length,
    backfilled,
    requeued,
    requeueFailed,
  };
}

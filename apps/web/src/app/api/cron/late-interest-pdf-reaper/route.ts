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

  const stuck = await prisma.invoiceInterestClaim.findMany({
    where: {
      pdfStatus: 'PENDING_RENDER',
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      organizationId: true,
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

    // Case 2: the QStash delivery never happened. Re-enqueue. We don't
    // touch the row — the worker will flip it to READY/FAILED when it
    // runs. If the re-enqueue itself fails, we leave the row so the next
    // reaper tick retries.
    try {
      await getQStashClient().publishJSON({
        url: qstashUrl,
        body: { claimId: row.id, organizationId: row.organizationId },
        retries: 3,
        timeout: '60s',
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

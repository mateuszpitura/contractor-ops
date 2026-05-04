// Outbox drain (P2-A, F-ASYNC-03).
//
// Polled by a QStash schedule every 30s (configured in ops). Each call drains
// up to `DRAIN_BATCH_LIMIT` PENDING events under `FOR UPDATE SKIP LOCKED`,
// so multiple workers can run concurrently without colliding.
//
// Authorization: `verifySignatureAppRouter` from the QStash SDK validates
// `Upstash-Signature` against `QSTASH_CURRENT_SIGNING_KEY` /
// `QSTASH_NEXT_SIGNING_KEY`. Same pattern as `/api/webhooks/_process`.

import {
  recordQueueDepth,
  withQueueObservability,
} from '@contractor-ops/api/services/cron-monitor';
import { drainOutboxBatch } from '@contractor-ops/api/services/outbox';
import { prismaRaw } from '@contractor-ops/db';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import * as Sentry from '@sentry/nextjs';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const log = createCronLogger('outbox-drain');

// Cap the request budget. The drain itself is bounded by DRAIN_BATCH_LIMIT
// (100 rows) plus per-handler latency. 60s is generous; if a handler ever
// exceeds it we'd rather time out and let the next tick retry than hold
// row locks longer than the platform timeout.
export const maxDuration = 60;

async function handler(_request: NextRequest) {
  // S3-5 · F-ASYNC-17: emit queue depth BEFORE the drain so dashboards
  // see the unprocessed backlog at the start of every tick (the in-flight
  // rows during the drain are excluded by the count's `status='PENDING'`
  // predicate). Wrap the whole tick with the queue-observability helper
  // to capture per-tick duration into the `job.duration` histogram.
  return withQueueObservability('outbox-drain', async () => {
    try {
      // Pending count is computed via raw SQL because the OutboxEvent model
      // is owned by P2-A and not exposed through the typed Prisma client
      // surface — same pattern as drainOutboxBatch itself. Read-only count
      // outside the drain transaction so we don't extend the lock window.
      const pendingBefore = await getPendingCount();
      if (pendingBefore !== null) {
        recordQueueDepth('outbox', pendingBefore);
      }

      const result = await drainOutboxBatch();

      metrics.gauge('outbox.drain.scanned', result.scanned);
      metrics.gauge('outbox.drain.dispatched', result.dispatched);
      metrics.gauge('outbox.drain.retried', result.retried);
      metrics.gauge('outbox.drain.exhausted', result.exhausted);

      if (result.scanned > 0) {
        log.info({ ...result, pendingBefore }, 'outbox drain tick');
      }

      return NextResponse.json(result);
    } catch (err) {
      log.error({ err }, 'outbox drain failed');
      Sentry.captureException(err, { tags: { 'outbox.outcome': 'drain-error' } });
      // Return 500 so QStash retries; transient drain errors (Postgres blip,
      // stale connection) recover on the next tick.
      return NextResponse.json({ error: 'drain failed' }, { status: 500 });
    }
  });
}

/**
 * Counts PENDING OutboxEvent rows whose nextAttemptAt is past. Used purely
 * for the `queue.depth queue:outbox` gauge — best-effort, swallow errors
 * and return null so a Postgres blip can't fail the drain tick.
 */
async function getPendingCount(): Promise<number | null> {
  try {
    const rows = await prismaRaw.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::bigint AS count FROM "OutboxEvent" WHERE "status" = 'PENDING' AND "nextAttemptAt" <= NOW()`,
    );
    const raw = rows[0]?.count ?? 0;
    return Number(raw);
  } catch (err) {
    log.warn({ err }, 'queue depth count failed — skipping gauge');
    return null;
  }
}

export const POST = verifySignatureAppRouter(handler);

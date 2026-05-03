// Outbox drain (P2-A, F-ASYNC-03).
//
// Polled by a QStash schedule every 30s (configured in ops). Each call drains
// up to `DRAIN_BATCH_LIMIT` PENDING events under `FOR UPDATE SKIP LOCKED`,
// so multiple workers can run concurrently without colliding.
//
// Authorization: `verifySignatureAppRouter` from the QStash SDK validates
// `Upstash-Signature` against `QSTASH_CURRENT_SIGNING_KEY` /
// `QSTASH_NEXT_SIGNING_KEY`. Same pattern as `/api/webhooks/_process`.

import { drainOutboxBatch } from '@contractor-ops/api/services/outbox';
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
  try {
    const result = await drainOutboxBatch();

    metrics.gauge('outbox.drain.scanned', result.scanned);
    metrics.gauge('outbox.drain.dispatched', result.dispatched);
    metrics.gauge('outbox.drain.retried', result.retried);
    metrics.gauge('outbox.drain.exhausted', result.exhausted);

    if (result.scanned > 0) {
      log.info(result, 'outbox drain tick');
    }

    return NextResponse.json(result);
  } catch (err) {
    log.error({ err }, 'outbox drain failed');
    Sentry.captureException(err, { tags: { 'outbox.outcome': 'drain-error' } });
    // Return 500 so QStash retries; transient drain errors (Postgres blip,
    // stale connection) recover on the next tick.
    return NextResponse.json({ error: 'drain failed' }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);

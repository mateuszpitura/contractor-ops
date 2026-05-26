/**
 * Outbox drain (`POST /outbox/_drain`) port.
 *
 * Mirrors apps/web/src/app/api/outbox/_drain/route.ts (P2-A · F-ASYNC-03).
 *
 *   1. QStash signature verification via `guardQStashRequest`.
 *   2. Wrap the whole tick with `withQueueObservability('outbox-drain', …)`
 *      so per-tick duration lands in the `job.duration` histogram.
 *   3. Read the pending-row count BEFORE the drain — gauges the
 *      unprocessed backlog (in-flight rows during the drain are excluded
 *      by the `status='PENDING'` predicate).
 *   4. Call `drainOutboxBatch()` which holds `FOR UPDATE SKIP LOCKED`
 *      across the row batch, so multiple workers can run concurrently
 *      without colliding.
 *   5. Emit four gauges (scanned/dispatched/retried/exhausted) so
 *      dashboards can chart drain pressure independently of depth.
 *   6. 200 on success; 500 on error → QStash retries with backoff.
 *
 * Polled every 30 s by a QStash schedule. Exempt from CSRF origin guard
 * via the `/outbox/` prefix.
 */

import {
  recordQueueDepth,
  withQueueObservability,
} from '@contractor-ops/api/services/cron-monitor';
import { drainOutboxBatch } from '@contractor-ops/api/services/outbox';
import { prismaRaw } from '@contractor-ops/db';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { guardQStashRequest } from '../lib/qstash-verify.js';
import { Sentry } from '../lib/sentry.js';

const log = createCronLogger('outbox-drain');

async function getPendingCount(): Promise<number | null> {
  try {
    // safe-raw-sql: queue.depth gauge is a global metric across all
    // tenants — intentionally not org-scoped.
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

async function handlerInner(reply: FastifyReply): Promise<FastifyReply> {
  return withQueueObservability('outbox-drain', async () => {
    try {
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

      return reply.code(200).send(result);
    } catch (err) {
      log.error({ err }, 'outbox drain failed');
      Sentry.captureException(err, { tags: { 'outbox.outcome': 'drain-error' } });
      // 500 so QStash retries — transient drain errors (Postgres blip,
      // stale connection) recover on the next tick.
      return reply.code(500).send({ error: 'drain failed' });
    }
  });
}

export function registerOutboxDrainRoute(app: FastifyInstance): void {
  app.post('/outbox/_drain', async (request, reply) => {
    const guard = await guardQStashRequest(request, reply);
    if (!guard) return reply;

    return guard.run(() => handlerInner(reply));
  });
}

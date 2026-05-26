/**
 * Background job health monitor + webhook reaper.
 *
 * Ported from apps/web/src/app/api/cron/job-health/route.ts.
 *
 * Runs every 5 minutes:
 *   1. Detects stale webhook deliveries (RECEIVED/PROCESSING > 15 min).
 *   2. F-INT-13 / P2-B reaper: bumps `attempts`, re-enqueues to QStash
 *      with exponential backoff capped at 1h; rows whose attempts
 *      exceed `MAX_REAPER_ATTEMPTS` flip to FAILED + Sentry capture.
 *   3. Counts recent failures (last hour) + queue depth.
 *   4. Fires Sentry alerts when failure-rate or queue-depth thresholds
 *      breach.
 */

import { prisma } from '@contractor-ops/db';
import { queueWebhookProcessing } from '@contractor-ops/integrations/services/webhook-dispatcher';
import { metrics } from '@contractor-ops/logger/metrics';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

const STALE_THRESHOLD_MIN = 15;
const FAILURE_ALERT_THRESHOLD = 10;
const MAX_REAPER_ATTEMPTS = 5;
const BACKOFF_BASE_SECONDS = 60;
const BACKOFF_MAX_SECONDS = 60 * 60;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: 1:1 port of legacy reaper + alerting pipeline
export const jobHealthHandler: JobHandler = async ctx => {
  const start = performance.now();
  try {
    const now = new Date();
    const staleCutoff = new Date(now.getTime() - STALE_THRESHOLD_MIN * 60_000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60_000);

    const staleDeliveries = await prisma.webhookDelivery.findMany({
      where: {
        deliveryStatus: { in: ['RECEIVED', 'PROCESSING'] },
        receivedAt: { lt: staleCutoff },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      select: {
        id: true,
        provider: true,
        organizationId: true,
        eventType: true,
        receivedAt: true,
        deliveryStatus: true,
        attempts: true,
      },
    });

    const toRetry: typeof staleDeliveries = [];
    const toFail: typeof staleDeliveries = [];
    for (const delivery of staleDeliveries) {
      if (delivery.attempts + 1 >= MAX_REAPER_ATTEMPTS) {
        toFail.push(delivery);
      } else {
        toRetry.push(delivery);
      }
    }

    let staleRetried = 0;
    for (const delivery of toRetry) {
      const nextAttempts = delivery.attempts + 1;
      const backoffSeconds = Math.min(
        BACKOFF_BASE_SECONDS * 2 ** delivery.attempts,
        BACKOFF_MAX_SECONDS,
      );
      const nextAttemptAt = new Date(now.getTime() + backoffSeconds * 1000);
      try {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            deliveryStatus: 'RECEIVED',
            attempts: nextAttempts,
            nextAttemptAt,
            lastErrorAt: now,
            lastError: `Reaper re-enqueue (attempt ${nextAttempts}/${MAX_REAPER_ATTEMPTS}) after ${STALE_THRESHOLD_MIN}min stall`,
          },
        });
        await queueWebhookProcessing(delivery.id, delivery.provider.toLowerCase());
        staleRetried++;
      } catch (retryErr) {
        ctx.log.error(
          {
            err: retryErr,
            deliveryId: delivery.id,
            provider: delivery.provider,
            attempts: nextAttempts,
          },
          'reaper retry enqueue failed',
        );
        Sentry.captureException(retryErr, {
          tags: {
            'cron.job': 'job-health',
            'webhook.provider': delivery.provider,
            'webhook.outcome': 'reaper-retry-failed',
          },
          extra: { deliveryId: delivery.id, attempts: nextAttempts },
        });
      }
    }

    if (toFail.length > 0) {
      await prisma.webhookDelivery.updateMany({
        where: { id: { in: toFail.map(d => d.id) } },
        data: {
          deliveryStatus: 'FAILED',
          processedAt: now,
          attempts: { increment: 1 },
          lastErrorAt: now,
          lastError: `Reaper exhausted ${MAX_REAPER_ATTEMPTS} attempts`,
          errorMessage: JSON.stringify({
            reason: `Stale: stuck in RECEIVED/PROCESSING beyond ${MAX_REAPER_ATTEMPTS} reaper attempts`,
            failedByHealthCheck: true,
            failedAt: now.toISOString(),
          }),
        },
      });

      for (const delivery of toFail) {
        Sentry.captureMessage('webhook delivery stale — reaper marked FAILED', {
          level: 'warning',
          tags: {
            'webhook.provider': delivery.provider,
            'webhook.outcome': 'reaper-failed',
            'webhook.observed_status': delivery.deliveryStatus,
          },
          extra: {
            deliveryId: delivery.id,
            organizationId: delivery.organizationId,
            eventType: delivery.eventType,
            receivedAt: delivery.receivedAt,
            attempts: delivery.attempts + 1,
            ageMinutes: Math.round((now.getTime() - delivery.receivedAt.getTime()) / 60_000),
          },
        });
      }
    }

    if (staleRetried > 0 || toFail.length > 0) {
      ctx.log.warn(
        {
          event: 'webhook_delivery_stale',
          retried: staleRetried,
          failed: toFail.length,
        },
        'reaper processed stale webhook deliveries',
      );
    }

    const recentFailureCount = await prisma.webhookDelivery.count({
      where: { deliveryStatus: 'FAILED', processedAt: { gte: oneHourAgo } },
    });

    const pendingCount = await prisma.webhookDelivery.count({
      where: { deliveryStatus: { in: ['RECEIVED', 'PROCESSING'] } },
    });

    metrics.gauge('jobs.webhook.pending', pendingCount);
    metrics.gauge('jobs.webhook.failures_1h', recentFailureCount);
    metrics.gauge('jobs.webhook.stale_retried', staleRetried);
    metrics.gauge('jobs.webhook.stale_cleared', toFail.length);

    if (recentFailureCount > FAILURE_ALERT_THRESHOLD) {
      const msg = `Background job alert: ${recentFailureCount} webhook delivery failures in the last hour (threshold: ${FAILURE_ALERT_THRESHOLD})`;
      ctx.log.error({ recentFailureCount, threshold: FAILURE_ALERT_THRESHOLD }, msg);
      Sentry.captureMessage(msg, {
        level: 'error',
        tags: { 'cron.job': 'job-health', 'alert.type': 'failure_threshold' },
        extra: {
          recentFailureCount,
          pendingCount,
          staleRetried,
          staleCleared: toFail.length,
        },
      });
    }

    if (pendingCount > 100) {
      const msg = `Background job alert: ${pendingCount} webhook deliveries pending (queue depth > 100)`;
      ctx.log.error({ pendingCount }, msg);
      Sentry.captureMessage(msg, {
        level: 'warning',
        tags: { 'cron.job': 'job-health', 'alert.type': 'queue_depth' },
        extra: { pendingCount, recentFailureCount },
      });
    }

    ctx.log.info(
      {
        pendingCount,
        recentFailureCount,
        staleRetried,
        staleCleared: toFail.length,
      },
      'job health check completed',
    );

    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: {
        pendingCount,
        recentFailureCount,
        staleRetried,
        staleCleared: toFail.length,
        healthy: recentFailureCount <= FAILURE_ALERT_THRESHOLD && pendingCount <= 100,
      },
    };
  } catch (err) {
    ctx.log.error({ err }, 'job health check failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'job-health' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};

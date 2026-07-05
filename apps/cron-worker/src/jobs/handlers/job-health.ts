/**
 * Background job health monitor + webhook reaper.
 *
 * Runs every 5 minutes:
 *   1. Detects stale webhook deliveries (RECEIVED/PROCESSING > 15 min).
 *   2. Reaper: bumps `attempts`, re-enqueues to QStash with exponential
 *      backoff capped at 1h; rows whose attempts exceed
 *      `MAX_REAPER_ATTEMPTS` flip to FAILED + Sentry capture.
 *   3. Counts recent failures (last hour) + queue depth.
 *   4. Fires Sentry alerts when failure-rate or queue-depth thresholds
 *      breach.
 *   5. Cron liveness: compares each persisted `CronJobRunState.lastSuccessAt`
 *      against the job's nominal interval and alerts when a job has not
 *      succeeded in more than 2× its interval (a scheduler that silently
 *      stopped firing a job is otherwise undetectable).
 */

import { prisma, prismaRaw } from '@contractor-ops/db';
import { queueWebhookProcessing } from '@contractor-ops/integrations/services/webhook-dispatcher';
import { metrics } from '@contractor-ops/logger/metrics';
import { Sentry } from '../../lib/sentry.js';
import { CRON_JOB_INTERVALS_MS } from '../job-meta.js';
import type { JobHandler } from '../runner.js';

const STALE_THRESHOLD_MIN = 15;
const FAILURE_ALERT_THRESHOLD = 10;
const MAX_REAPER_ATTEMPTS = 5;
const BACKOFF_BASE_SECONDS = 60;
const BACKOFF_MAX_SECONDS = 60 * 60;
/** A job is stale once it has not succeeded in more than this × its interval. */
const STALE_INTERVAL_MULTIPLIER = 2;

type StaleDelivery = {
  id: string;
  provider: string;
  organizationId: string;
  eventType: string | null;
  receivedAt: Date;
  deliveryStatus: string;
  attempts: number;
};

type JobHandlerCtx = Parameters<JobHandler>[0];

/**
 * Re-enqueue stale-but-retriable deliveries with exponential backoff. Each
 * enqueue failure is logged + reported to Sentry but does not abort the batch.
 * Returns the count of successfully re-enqueued rows.
 */
async function retryStaleDeliveries(
  toRetry: StaleDelivery[],
  now: Date,
  ctx: JobHandlerCtx,
): Promise<number> {
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
  return staleRetried;
}

/**
 * Flip deliveries that exhausted their reaper attempts to FAILED (single
 * `updateMany`) and emit a per-row Sentry warning.
 */
async function failExhaustedDeliveries(toFail: StaleDelivery[], now: Date): Promise<void> {
  if (toFail.length === 0) return;

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

/**
 * Compare each persisted cron job's `lastSuccessAt` against its nominal
 * interval and alert on any that has not succeeded in more than
 * `STALE_INTERVAL_MULTIPLIER × interval`. A job that has a row but never
 * succeeded is measured from `createdAt`. Jobs without a known interval
 * (legacy rows) are skipped. Its own try/catch — a failure here must not
 * abort the webhook reaper above.
 */
async function checkStaleCronJobs(now: Date, ctx: JobHandlerCtx): Promise<number> {
  try {
    const states = await prismaRaw.cronJobRunState.findMany({
      select: { jobName: true, lastSuccessAt: true, createdAt: true },
    });

    let stale = 0;
    for (const state of states) {
      const intervalMs = CRON_JOB_INTERVALS_MS[state.jobName];
      if (intervalMs === undefined) continue;

      const reference = state.lastSuccessAt ?? state.createdAt;
      const ageMs = now.getTime() - reference.getTime();
      if (ageMs <= intervalMs * STALE_INTERVAL_MULTIPLIER) continue;

      stale++;
      const ageMinutes = Math.round(ageMs / 60_000);
      const intervalMinutes = Math.round(intervalMs / 60_000);
      const msg = `Background job alert: cron job "${state.jobName}" has not succeeded in ${ageMinutes}min (interval ${intervalMinutes}min, threshold ${STALE_INTERVAL_MULTIPLIER}×)`;
      ctx.log.error(
        {
          jobName: state.jobName,
          lastSuccessAt: state.lastSuccessAt,
          ageMs,
          intervalMs,
        },
        msg,
      );
      Sentry.captureMessage(msg, {
        level: 'error',
        tags: {
          'cron.job': 'job-health',
          'alert.type': 'cron_job_stale',
          'stale.job': state.jobName,
        },
        extra: {
          lastSuccessAt: state.lastSuccessAt?.toISOString() ?? 'never',
          ageMinutes,
          intervalMinutes,
        },
      });
    }

    metrics.gauge('jobs.cron.stale', stale);
    return stale;
  } catch (err) {
    ctx.log.error({ err }, 'cron staleness check failed');
    Sentry.captureException(err, {
      tags: { 'cron.job': 'job-health', 'alert.type': 'cron_job_stale_check_failed' },
    });
    return 0;
  }
}

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

    const toRetry: StaleDelivery[] = [];
    const toFail: StaleDelivery[] = [];
    for (const delivery of staleDeliveries) {
      if (delivery.attempts + 1 >= MAX_REAPER_ATTEMPTS) {
        toFail.push(delivery);
      } else {
        toRetry.push(delivery);
      }
    }

    const staleRetried = await retryStaleDeliveries(toRetry, now, ctx);
    await failExhaustedDeliveries(toFail, now);

    const staleCronJobs = await checkStaleCronJobs(now, ctx);

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
        staleCronJobs,
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
        staleCronJobs,
        healthy:
          recentFailureCount <= FAILURE_ALERT_THRESHOLD &&
          pendingCount <= 100 &&
          staleCronJobs === 0,
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

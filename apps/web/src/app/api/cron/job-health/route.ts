import { timingSafeEqual } from 'node:crypto';
import { withCronMonitor } from '@contractor-ops/api/services/cron-monitor';
import { prisma } from '@contractor-ops/db';
import { queueWebhookProcessing } from '@contractor-ops/integrations/services/webhook-dispatcher';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import { getServerEnv } from '@contractor-ops/validators';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const log = createCronLogger('job-health');

/**
 * Webhook deliveries stuck in RECEIVED or PROCESSING longer than this are
 * considered stale. RECEIVED = QStash never picked it up; PROCESSING = a
 * worker claimed it but crashed before finishing.
 */
const STALE_THRESHOLD_MIN = 15;

/** Alert threshold: fire a Sentry alert when recent failure count exceeds this. */
const FAILURE_ALERT_THRESHOLD = 10;

/**
 * F-INT-13 / P2-B reaper retry budget. Each reaper pass that finds a
 * stale row bumps `attempts` and reschedules with exponential backoff
 * (60s × 2^attempts, capped at 1h). Once `attempts >= MAX_REAPER_ATTEMPTS`
 * the row is marked FAILED and surfaced for manual triage. 5 attempts
 * across the backoff schedule (1m, 2m, 4m, 8m, 16m) gives roughly 30
 * minutes of total retry coverage before declaring the row dead — long
 * enough to absorb a Render scale-up bounce or a transient QStash outage,
 * short enough to keep the failure signal sharp.
 */
const MAX_REAPER_ATTEMPTS = 5;
const BACKOFF_BASE_SECONDS = 60;
const BACKOFF_MAX_SECONDS = 60 * 60;

// ---------------------------------------------------------------------------
// GET /api/cron/job-health
// ---------------------------------------------------------------------------

/**
 * Background job health monitor — runs every 5 minutes.
 *
 * 1. Detects stale webhook deliveries (RECEIVED for > 15 min)
 * 2. Counts recent failures (last hour) across webhook deliveries
 * 3. Marks stale deliveries as FAILED (dead letter pattern)
 * 4. Reports metrics and fires Sentry alerts when thresholds breached
 */
export async function GET(request: NextRequest) {
  // Resolve CRON_SECRET via getServerEnv so length validation (min 16) is enforced
  // at module load. Defensive guard ensures we never accept a missing/short secret
  // (which would let `Authorization: Bearer ` (length 7) bypass the auth check).
  const cronSecret = getServerEnv().CRON_SECRET;
  if (!cronSecret || cronSecret.length < 16) {
    log.error('CRON_SECRET misconfigured — refusing to run job-health');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${cronSecret}`;
  const isAuthorized =
    authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Sentry.withMonitor(
    'job-health',
    () =>
      withCronMonitor('job-health', async () => {
        try {
          const now = new Date();
          const staleCutoff = new Date(now.getTime() - STALE_THRESHOLD_MIN * 60_000);
          const oneHourAgo = new Date(now.getTime() - 60 * 60_000);

          // 1. Find stale webhook deliveries (stuck in RECEIVED or PROCESSING)
          //    whose backoff window has elapsed. RECEIVED stale = QStash never
          //    delivered it to _process (or delivered but crashed pre-claim).
          //    PROCESSING stale = a worker claimed the row but crashed before
          //    finishing (no PROCESSED/FAILED transition).
          //
          // F-INT-13 / P2-B: with the `attempts` / `nextAttemptAt` columns
          // landed, the reaper now distinguishes "transient stall — retry"
          // from "definitively dead — fail". Each pass:
          //   - Selects rows where `nextAttemptAt` is null (first stall) OR
          //     `nextAttemptAt < now` (backoff elapsed).
          //   - Bumps `attempts` and computes the next backoff window.
          //   - If `attempts < MAX_REAPER_ATTEMPTS`: re-enqueues into QStash
          //     (the existing `webhook.process` consumer dedups via the
          //     deliveryId, so a duplicate publish from the reaper races
          //     harmlessly with whatever was originally lost).
          //   - Otherwise: marks FAILED and captures Sentry for triage.
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

          // 2. Bucket stale rows into "retry" vs. "give up" cohorts.
          const toRetry: typeof staleDeliveries = [];
          const toFail: typeof staleDeliveries = [];
          for (const delivery of staleDeliveries) {
            if (delivery.attempts + 1 >= MAX_REAPER_ATTEMPTS) {
              toFail.push(delivery);
            } else {
              toRetry.push(delivery);
            }
          }

          // 3. Retry cohort: bump attempts, schedule the next backoff
          //    window, and re-publish to QStash. Per-row updates so each
          //    `nextAttemptAt` reflects that row's specific attempt count.
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
                  // Reset to RECEIVED so the consumer's compare-and-swap claim
                  // can pick the row up again. The QStash publish below
                  // dedups against deliveryId so we are safe against the
                  // worker that originally claimed the row racing back.
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
              // Don't let a single failed retry abort the whole pass — log
              // and let the next reaper pass try again.
              log.error(
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

          // 4. Give-up cohort: mark FAILED and surface for ops follow-up.
          if (toFail.length > 0) {
            await prisma.webhookDelivery.updateMany({
              where: {
                id: { in: toFail.map(d => d.id) },
              },
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
            log.warn(
              {
                event: 'webhook_delivery_stale',
                retried: staleRetried,
                failed: toFail.length,
                deliveries: staleDeliveries.map(d => ({
                  id: d.id,
                  provider: d.provider,
                  eventType: d.eventType,
                  receivedAt: d.receivedAt,
                  observedStatus: d.deliveryStatus,
                  attempts: d.attempts,
                })),
              },
              'reaper processed stale webhook deliveries',
            );
          }

          // 3. Count recent failures (last hour)
          const recentFailureCount = await prisma.webhookDelivery.count({
            where: {
              deliveryStatus: 'FAILED',
              processedAt: { gte: oneHourAgo },
            },
          });

          // 4. Count pending (queue depth) — both waiting-for-pickup and in-flight
          const pendingCount = await prisma.webhookDelivery.count({
            where: {
              deliveryStatus: { in: ['RECEIVED', 'PROCESSING'] },
            },
          });

          // 5. Report metrics — split retried vs. failed so dashboards can
          //    distinguish "transient stalls being absorbed by the reaper"
          //    (healthy: retries succeeding) from "definitive dead letters"
          //    (unhealthy: rows exhausting their attempt budget).
          metrics.gauge('jobs.webhook.pending', pendingCount);
          metrics.gauge('jobs.webhook.failures_1h', recentFailureCount);
          metrics.gauge('jobs.webhook.stale_retried', staleRetried);
          metrics.gauge('jobs.webhook.stale_cleared', toFail.length);

          // 6. Alert if failure threshold breached
          if (recentFailureCount > FAILURE_ALERT_THRESHOLD) {
            const alertMessage = `Background job alert: ${recentFailureCount} webhook delivery failures in the last hour (threshold: ${FAILURE_ALERT_THRESHOLD})`;
            log.error({ recentFailureCount, threshold: FAILURE_ALERT_THRESHOLD }, alertMessage);
            Sentry.captureMessage(alertMessage, {
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

          // 7. Alert if queue depth is high
          if (pendingCount > 100) {
            const alertMessage = `Background job alert: ${pendingCount} webhook deliveries pending (queue depth > 100)`;
            log.error({ pendingCount }, alertMessage);
            Sentry.captureMessage(alertMessage, {
              level: 'warning',
              tags: { 'cron.job': 'job-health', 'alert.type': 'queue_depth' },
              extra: { pendingCount, recentFailureCount },
            });
          }

          log.info(
            {
              pendingCount,
              recentFailureCount,
              staleRetried,
              staleCleared: toFail.length,
            },
            'job health check completed',
          );

          return NextResponse.json({
            pendingCount,
            recentFailureCount,
            staleRetried,
            staleCleared: toFail.length,
            healthy: recentFailureCount <= FAILURE_ALERT_THRESHOLD && pendingCount <= 100,
          });
        } catch (error) {
          log.error({ err: error }, 'job health check failed');
          Sentry.captureException(error, {
            tags: { 'cron.job': 'job-health' },
          });
          return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
        }
      }),
    {
      schedule: { type: 'crontab', value: '*/5 * * * *' },
      timezone: 'UTC',
    },
  );
}

import { timingSafeEqual } from 'node:crypto';
import { withCronMonitor } from '@contractor-ops/api/services/cron-monitor';
import { prisma } from '@contractor-ops/db';
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

          // 1. Find stale webhook deliveries (stuck in RECEIVED or PROCESSING).
          //    RECEIVED stale = QStash never delivered it to _process (or
          //    delivered but crashed pre-claim).
          //    PROCESSING stale = a worker claimed the row but crashed before
          //    finishing (no PROCESSED/FAILED transition).
          //
          // F-ASYNC-05: pre-fix this just nuked PROCESSING rows to FAILED
          // after 15min, which lost slow-but-legit handlers (Jira PR
          // enrichment, e-sign ZIP generation can take 20+min). The right
          // fix needs an `attempts` counter on WebhookDelivery (F-INT-13,
          // owned by P2-B). For now the reaper:
          //   - Keeps the timeout-and-FAIL behaviour (no regression on the
          //     genuinely-crashed cases) so as not to leave PROCESSING rows
          //     forever.
          //   - Logs a Sentry capture per stale row so ops can find slow
          //     legit cases when they happen.
          //   - Tags with `event: 'webhook_delivery_stale'` for grep.
          //
          // TODO(P2-B, F-INT-13): once WebhookDelivery has `attempts` /
          // `nextAttemptAt` / `lastErrorAt`, change this to "if attempts <
          // maxAttempts and nextAttemptAt < now, re-enqueue PROCESSING ↺
          // RECEIVED; only after maxAttempts mark FAILED".
          const staleDeliveries = await prisma.webhookDelivery.findMany({
            where: {
              deliveryStatus: { in: ['RECEIVED', 'PROCESSING'] },
              receivedAt: { lt: staleCutoff },
            },
            select: {
              id: true,
              provider: true,
              organizationId: true,
              eventType: true,
              receivedAt: true,
              deliveryStatus: true,
            },
          });

          // 2. Mark stale deliveries as FAILED (dead letter) and surface
          //    each one for ops follow-up.
          if (staleDeliveries.length > 0) {
            await prisma.webhookDelivery.updateMany({
              where: {
                id: { in: staleDeliveries.map(d => d.id) },
              },
              data: {
                deliveryStatus: 'FAILED',
                processedAt: now,
                errorMessage: JSON.stringify({
                  reason: `Stale: stuck in RECEIVED/PROCESSING for >${STALE_THRESHOLD_MIN} minutes`,
                  failedByHealthCheck: true,
                  failedAt: now.toISOString(),
                }),
              },
            });

            for (const delivery of staleDeliveries) {
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
                  ageMinutes: Math.round((now.getTime() - delivery.receivedAt.getTime()) / 60_000),
                },
              });
            }

            log.warn(
              {
                count: staleDeliveries.length,
                event: 'webhook_delivery_stale',
                deliveries: staleDeliveries.map(d => ({
                  id: d.id,
                  provider: d.provider,
                  eventType: d.eventType,
                  receivedAt: d.receivedAt,
                  observedStatus: d.deliveryStatus,
                })),
              },
              'marked stale webhook deliveries as FAILED',
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

          // 5. Report metrics
          metrics.gauge('jobs.webhook.pending', pendingCount);
          metrics.gauge('jobs.webhook.failures_1h', recentFailureCount);
          metrics.gauge('jobs.webhook.stale_cleared', staleDeliveries.length);

          // 6. Alert if failure threshold breached
          if (recentFailureCount > FAILURE_ALERT_THRESHOLD) {
            const alertMessage = `Background job alert: ${recentFailureCount} webhook delivery failures in the last hour (threshold: ${FAILURE_ALERT_THRESHOLD})`;
            log.error({ recentFailureCount, threshold: FAILURE_ALERT_THRESHOLD }, alertMessage);
            Sentry.captureMessage(alertMessage, {
              level: 'error',
              tags: { 'cron.job': 'job-health', 'alert.type': 'failure_threshold' },
              extra: { recentFailureCount, pendingCount, staleCleared: staleDeliveries.length },
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
              staleCleared: staleDeliveries.length,
            },
            'job health check completed',
          );

          return NextResponse.json({
            pendingCount,
            recentFailureCount,
            staleCleared: staleDeliveries.length,
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

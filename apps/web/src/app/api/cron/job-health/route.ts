import { timingSafeEqual } from "node:crypto";
import { withCronMonitor } from "@contractor-ops/api/services/cron-monitor";
import { prisma } from "@contractor-ops/db";
import { createCronLogger } from "@contractor-ops/logger";
import { metrics } from "@contractor-ops/logger/metrics";
import * as Sentry from "@sentry/nextjs";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const log = createCronLogger("job-health");

/** Webhook deliveries stuck in RECEIVED longer than this are considered stale. */
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
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const isAuthorized =
    authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Sentry.withMonitor(
    "job-health",
    () =>
      withCronMonitor("job-health", async () => {
        try {
          const now = new Date();
          const staleCutoff = new Date(now.getTime() - STALE_THRESHOLD_MIN * 60_000);
          const oneHourAgo = new Date(now.getTime() - 60 * 60_000);

          // 1. Find stale webhook deliveries (stuck in RECEIVED)
          const staleDeliveries = await prisma.webhookDelivery.findMany({
            where: {
              deliveryStatus: "RECEIVED",
              receivedAt: { lt: staleCutoff },
            },
            select: {
              id: true,
              provider: true,
              organizationId: true,
              eventType: true,
              receivedAt: true,
            },
          });

          // 2. Mark stale deliveries as FAILED (dead letter)
          if (staleDeliveries.length > 0) {
            await prisma.webhookDelivery.updateMany({
              where: {
                id: { in: staleDeliveries.map((d) => d.id) },
              },
              data: {
                deliveryStatus: "FAILED",
                processedAt: now,
                errorMessage: JSON.stringify({
                  reason: `Stale: stuck in RECEIVED for >${STALE_THRESHOLD_MIN} minutes`,
                  failedByHealthCheck: true,
                  failedAt: now.toISOString(),
                }),
              },
            });

            log.warn(
              {
                count: staleDeliveries.length,
                deliveries: staleDeliveries.map((d) => ({
                  id: d.id,
                  provider: d.provider,
                  eventType: d.eventType,
                  receivedAt: d.receivedAt,
                })),
              },
              "marked stale webhook deliveries as FAILED",
            );
          }

          // 3. Count recent failures (last hour)
          const recentFailureCount = await prisma.webhookDelivery.count({
            where: {
              deliveryStatus: "FAILED",
              processedAt: { gte: oneHourAgo },
            },
          });

          // 4. Count pending (queue depth)
          const pendingCount = await prisma.webhookDelivery.count({
            where: {
              deliveryStatus: "RECEIVED",
            },
          });

          // 5. Report metrics
          metrics.gauge("jobs.webhook.pending", pendingCount);
          metrics.gauge("jobs.webhook.failures_1h", recentFailureCount);
          metrics.gauge("jobs.webhook.stale_cleared", staleDeliveries.length);

          // 6. Alert if failure threshold breached
          if (recentFailureCount > FAILURE_ALERT_THRESHOLD) {
            const alertMessage = `Background job alert: ${recentFailureCount} webhook delivery failures in the last hour (threshold: ${FAILURE_ALERT_THRESHOLD})`;
            log.error({ recentFailureCount, threshold: FAILURE_ALERT_THRESHOLD }, alertMessage);
            Sentry.captureMessage(alertMessage, {
              level: "error",
              tags: { "cron.job": "job-health", "alert.type": "failure_threshold" },
              extra: { recentFailureCount, pendingCount, staleCleared: staleDeliveries.length },
            });
          }

          // 7. Alert if queue depth is high
          if (pendingCount > 100) {
            const alertMessage = `Background job alert: ${pendingCount} webhook deliveries pending (queue depth > 100)`;
            log.error({ pendingCount }, alertMessage);
            Sentry.captureMessage(alertMessage, {
              level: "warning",
              tags: { "cron.job": "job-health", "alert.type": "queue_depth" },
              extra: { pendingCount, recentFailureCount },
            });
          }

          log.info(
            {
              pendingCount,
              recentFailureCount,
              staleCleared: staleDeliveries.length,
            },
            "job health check completed",
          );

          return NextResponse.json({
            pendingCount,
            recentFailureCount,
            staleCleared: staleDeliveries.length,
            healthy: recentFailureCount <= FAILURE_ALERT_THRESHOLD && pendingCount <= 100,
          });
        } catch (error) {
          log.error({ err: error }, "job health check failed");
          Sentry.captureException(error, {
            tags: { "cron.job": "job-health" },
          });
          return NextResponse.json({ error: "Health check failed" }, { status: 500 });
        }
      }),
    {
      schedule: { type: "crontab", value: "*/5 * * * *" },
      timezone: "UTC",
    },
  );
}

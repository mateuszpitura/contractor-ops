import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@contractor-ops/db";
import { dispatch } from "@contractor-ops/api/services/notification-service";
import { withCronMonitor } from "@contractor-ops/api/services/cron-monitor";
import { createCronLogger } from "@contractor-ops/logger";
import { metrics } from "@contractor-ops/logger/metrics";
import { Resend } from "resend";

const log = createCronLogger("trial-notifications");

// ---------------------------------------------------------------------------
// Resend client (lazy init)
// ---------------------------------------------------------------------------

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function buildBillingUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/settings?tab=billing`;
}

// ---------------------------------------------------------------------------
// GET /api/cron/trial-notifications
// ---------------------------------------------------------------------------

/**
 * Vercel Cron endpoint for trial expiry notifications.
 *
 * Stripe only sends `trial_will_end` at 3 days before expiry.
 * Per D-10, we also need notifications at 7 days and 1 day.
 * Runs daily at 09:00 UTC (configured in vercel.json).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Sentry.withMonitor("trial-notifications", () => withCronMonitor("trial-notifications", handleTrialNotifications), {
    schedule: { type: "crontab", value: "0 9 * * *" },
    timezone: "UTC",
  });
}

async function handleTrialNotifications() {
  let notificationCount = 0;

  try {
    const trialingSubscriptions = await prisma.subscription.findMany({
      where: {
        status: "TRIALING",
        trialEnd: { not: null },
      },
      include: {
        organization: {
          select: {
            id: true,
            billingEmail: true,
            members: {
              where: { role: { in: ["owner", "admin"] } },
              select: { userId: true },
            },
          },
        },
      },
    });

    const now = new Date();

    for (const sub of trialingSubscriptions) {
      if (!sub.trialEnd) continue;

      const daysUntilTrialEnd = Math.ceil(
        (sub.trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      const adminUserIds = sub.organization.members.map(
        (m: { userId: string }) => m.userId,
      );

      if (daysUntilTrialEnd === 7) {
        // 7-day notification
        if (adminUserIds.length > 0) {
          await dispatch({
            organizationId: sub.organization.id,
            type: "TRIAL_ENDING",
            recipientUserIds: adminUserIds,
            title: "Trial ending in 7 days",
            body: "Your trial ends in 7 days. Upgrade to keep your data and full access.",
            entityType: "ORGANIZATION",
            entityId: sub.organization.id,
          });
        }

        if (sub.organization.billingEmail) {
          try {
            const resend = getResend();
            await resend.emails.send({
              from: "Contractor Ops <notifications@contractorhub.io>",
              to: sub.organization.billingEmail,
              subject: "Your Contractor Ops trial ends in 7 days",
              html: `<p>Your trial ends in 7 days. Upgrade to keep your data and full access.</p><p><a href="${buildBillingUrl()}">Go to billing settings</a></p>`,
            });
          } catch (error) {
            log.error({ err: error }, "email send failed");
          }
        }

        notificationCount++;
      }

      if (daysUntilTrialEnd === 1) {
        // 1-day notification
        if (adminUserIds.length > 0) {
          await dispatch({
            organizationId: sub.organization.id,
            type: "TRIAL_ENDING",
            recipientUserIds: adminUserIds,
            title: "Trial ending tomorrow",
            body: "Your trial ends tomorrow. Upgrade now to avoid losing access to features.",
            entityType: "ORGANIZATION",
            entityId: sub.organization.id,
          });
        }

        if (sub.organization.billingEmail) {
          try {
            const resend = getResend();
            await resend.emails.send({
              from: "Contractor Ops <notifications@contractorhub.io>",
              to: sub.organization.billingEmail,
              subject: "Your Contractor Ops trial ends tomorrow",
              html: `<p>Your trial ends tomorrow. Upgrade now to avoid losing access to features.</p><p><a href="${buildBillingUrl()}">Go to billing settings</a></p>`,
            });
          } catch (error) {
            log.error({ err: error }, "email send failed");
          }
        }

        notificationCount++;
      }
    }

    log.info(
      { processed: trialingSubscriptions.length, sent: notificationCount },
      "cron completed",
    );
    metrics.gauge("cron.trial_notifications.sent", notificationCount);

    return NextResponse.json({
      processed: trialingSubscriptions.length,
      notificationsSent: notificationCount,
    });
  } catch (error) {
    log.error({ err: error }, "cron handler failed");
    Sentry.captureException(error, {
      tags: { "cron.job": "trial-notifications" },
    });
    return NextResponse.json(
      { error: "Cron processing failed" },
      { status: 500 },
    );
  }
}


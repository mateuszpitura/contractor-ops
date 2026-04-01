import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { prisma } from "@contractor-ops/db";
import { dispatch } from "@contractor-ops/api/services/notification-service";
import { Resend } from "resend";

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
// POST /api/cron/trial-notifications
// ---------------------------------------------------------------------------

/**
 * QStash cron endpoint for trial expiry notifications.
 *
 * Stripe only sends `trial_will_end` at 3 days before expiry.
 * Per D-10, we also need notifications at 7 days and 1 day.
 * This cron runs daily (recommended: 0 9 * * *).
 */
async function handler(_request: NextRequest) {
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
            console.error(
              "[trial-notifications] Email send failed:",
              error,
            );
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
            console.error(
              "[trial-notifications] Email send failed:",
              error,
            );
          }
        }

        notificationCount++;
      }
    }

    return NextResponse.json({
      processed: trialingSubscriptions.length,
      notificationsSent: notificationCount,
    });
  } catch (error) {
    console.error("[trial-notifications] Cron handler failed:", error);
    return NextResponse.json(
      { error: "Cron processing failed" },
      { status: 500 },
    );
  }
}

// Wrap with QStash signature verification
export const POST = verifySignatureAppRouter(handler);

import { tryAcquireXactLock } from '@contractor-ops/api/lib/advisory-lock';
import { sendAppEmail } from '@contractor-ops/api/services/app-email';
import { withCronMonitor } from '@contractor-ops/api/services/cron-monitor';
import { dispatch } from '@contractor-ops/api/services/notification-service';
import { prisma, prismaRaw } from '@contractor-ops/db';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withNoStore } from '@/lib/cache-control';

const log = createCronLogger('trial-notifications');

// Cache-Control: no-store, private — internal cron endpoint, never cached.
export const dynamic = 'force-dynamic';

// F-ASYNC-07 — advisory lock prevents two overlapping ticks (timezone shift,
// scheduler retry, manual re-trigger) from both fanning out to every
// TRIALING subscription.
//
// Lock key under the `'cron'` namespace (see packages/api/src/lib/advisory-lock.ts).
// The namespace partitions the keyspace from per-org / payment / sync locks.
const TRIAL_NOTIFICATIONS_LOCK_KEY = 'trial-notifications';

function buildBillingUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
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
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return withNoStore(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  }

  const response = await Sentry.withMonitor(
    'trial-notifications',
    () => withCronMonitor('trial-notifications', handleTrialNotifications),
    {
      schedule: { type: 'crontab', value: '0 9 * * *' },
      timezone: 'UTC',
    },
  );
  return withNoStore(response);
}

// ---------------------------------------------------------------------------
// Notification templates by days-until-expiry
// ---------------------------------------------------------------------------

interface TrialTemplate {
  title: string;
  body: string;
  emailSubject: string;
  emailBody: string;
}

const TRIAL_NOTIFICATION_TEMPLATES: Record<number, TrialTemplate> = {
  7: {
    title: 'Trial ending in 7 days',
    body: 'Your trial ends in 7 days. Upgrade to keep your data and full access.',
    emailSubject: 'Your Contractor Ops trial ends in 7 days',
    emailBody: 'Your trial ends in 7 days. Upgrade to keep your data and full access.',
  },
  1: {
    title: 'Trial ending tomorrow',
    body: 'Your trial ends tomorrow. Upgrade now to avoid losing access to features.',
    emailSubject: 'Your Contractor Ops trial ends tomorrow',
    emailBody: 'Your trial ends tomorrow. Upgrade now to avoid losing access to features.',
  },
};

async function sendTrialNotification(
  organization: { id: string; billingEmail: string | null },
  adminUserIds: string[],
  template: TrialTemplate,
  daysUntilTrialEnd: number,
  todayBucket: string,
): Promise<{ skipped: boolean }> {
  // F-ASYNC-07: idempotent dedup via NotificationCronDedup. The cron-tick may
  // run twice (timezone shift, retry, manual re-trigger); the unique
  // dedupeKey makes the second tick a no-op for THIS subscription.
  const dedupeKey = `trial-end:${organization.id}:${daysUntilTrialEnd}:${todayBucket}`;
  try {
    await prisma.notificationCronDedup.create({ data: { dedupeKey } });
  } catch (err) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: unknown }).code === 'P2002'
    ) {
      // Duplicate tick — short-circuit silently.
      return { skipped: true };
    }
    throw err;
  }

  if (adminUserIds.length > 0) {
    await dispatch({
      organizationId: organization.id,
      type: 'TRIAL_ENDING',
      recipientUserIds: adminUserIds,
      title: template.title,
      body: template.body,
      entityType: 'ORGANIZATION',
      entityId: organization.id,
    });
  }

  if (organization.billingEmail) {
    try {
      await sendAppEmail({
        from: 'Contractor Ops <notifications@contractorhub.io>',
        to: organization.billingEmail,
        subject: template.emailSubject,
        html: `<p>${template.emailBody}</p><p><a href="${buildBillingUrl()}">Go to billing settings</a></p>`,
      });
    } catch (error) {
      log.error({ err: error }, 'email send failed');
    }
  }

  return { skipped: false };
}

async function handleTrialNotifications() {
  let notificationCount = 0;
  let skippedDedup = 0;

  try {
    // F-ASYNC-07 advisory lock — prevents two overlapping ticks both walking
    // every TRIALING subscription. Note: the inner per-org dedupeKey still
    // matters because cron auto-runs with a new tx PER tick can race the
    // lock, but in practice the lock + the unique dedupeKey are belt+braces.
    //
    // F-SCALE-07 — explicit `timeout` / `maxWait`. The walk fans out an
    // email + per-recipient notifications inside the tx; without a
    // ceiling a single slow Resend HTTP call could keep the advisory
    // lock past the next cron tick and block subsequent runs. 60 s
    // matches the ceiling on `reminders` cron; 10 s `maxWait` keeps a
    // queued tick from stacking.
    const result = await prismaRaw.$transaction(
      async tx => {
        const acquired = await tryAcquireXactLock(tx, 'cron', TRIAL_NOTIFICATIONS_LOCK_KEY);
        if (!acquired) {
          log.info('another trial-notifications tick is in flight; skipping');
          metrics.increment('cron.trial_notifications.skipped_locked');
          return { processed: 0, skipped: true as const };
        }

        const trialingSubscriptions = await prisma.subscription.findMany({
          where: {
            status: 'TRIALING',
            trialEnd: { not: null },
          },
          include: {
            organization: {
              select: {
                id: true,
                billingEmail: true,
                members: {
                  where: { role: { in: ['owner', 'admin'] } },
                  select: { userId: true },
                },
              },
            },
          },
        });

        const now = new Date();
        const todayBucket = now.toISOString().slice(0, 10); // YYYY-MM-DD

        for (const sub of trialingSubscriptions) {
          if (!sub.trialEnd) continue;

          const daysUntilTrialEnd = Math.ceil(
            (sub.trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );

          const template = TRIAL_NOTIFICATION_TEMPLATES[daysUntilTrialEnd];
          if (!template) continue;

          const adminUserIds = sub.organization.members.map((m: { userId: string }) => m.userId);

          const sendResult = await sendTrialNotification(
            sub.organization,
            adminUserIds,
            template,
            daysUntilTrialEnd,
            todayBucket,
          );
          if (sendResult.skipped) {
            skippedDedup++;
          } else {
            notificationCount++;
          }
        }

        return { processed: trialingSubscriptions.length, skipped: false as const };
      },
      { timeout: 60_000, maxWait: 10_000 },
    );

    log.info(
      {
        processed: result.processed,
        sent: notificationCount,
        skippedDedup,
        skipped: result.skipped,
      },
      'cron completed',
    );
    metrics.gauge('cron.trial_notifications.sent', notificationCount);
    metrics.gauge('cron.trial_notifications.skipped_dedup', skippedDedup);

    return NextResponse.json({
      processed: result.processed,
      notificationsSent: notificationCount,
      skippedDedup,
      skippedLocked: result.skipped,
    });
  } catch (error) {
    log.error({ err: error }, 'cron handler failed');
    Sentry.captureException(error, {
      tags: { 'cron.job': 'trial-notifications' },
    });
    return NextResponse.json({ error: 'Cron processing failed' }, { status: 500 });
  }
}

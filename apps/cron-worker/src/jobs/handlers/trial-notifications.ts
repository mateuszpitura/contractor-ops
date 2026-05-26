/**
 * Trial-end notifications handler.
 *
 * Ported from apps/web/src/app/api/cron/trial-notifications/route.ts.
 *
 * Daily 09:00 UTC sweep — Stripe only fires `trial_will_end` at 3 days
 * before expiry; per D-10 we also want notifications at 7 days and 1 day.
 *
 *   - F-ASYNC-07 — outer advisory lock prevents overlapping ticks
 *     (timezone shift / scheduler retry / manual re-trigger) from both
 *     fanning out to every TRIALING subscription.
 *   - Per-org `NotificationCronDedup` row by composite key
 *     `trial-end:{orgId}:{daysUntilEnd}:{YYYY-MM-DD}` — second tick is a
 *     no-op for the same subscription.
 *   - F-SCALE-07 — 60s tx timeout / 10s maxWait so a slow Resend send
 *     can't hold the lock past the next tick.
 */

import { tryAcquireXactLock } from '@contractor-ops/api/lib/advisory-lock';
import { sendAppEmail } from '@contractor-ops/api/services/app-email';
import { dispatch } from '@contractor-ops/api/services/notification-service';
import { prisma, prismaRaw } from '@contractor-ops/db';
import { metrics } from '@contractor-ops/logger/metrics';
import { loadEnv } from '../../env.js';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

const TRIAL_NOTIFICATIONS_LOCK_KEY = 'trial-notifications';

function buildBillingUrl(): string {
  const base = loadEnv().NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base}/settings?tab=billing`;
}

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
  log: Parameters<JobHandler>[0]['log'],
): Promise<{ skipped: boolean }> {
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

export const trialNotificationsHandler: JobHandler = async ctx => {
  const start = performance.now();
  let notificationCount = 0;
  let skippedDedup = 0;

  try {
    const result = await prismaRaw.$transaction(
      async tx => {
        const acquired = await tryAcquireXactLock(tx, 'cron', TRIAL_NOTIFICATIONS_LOCK_KEY);
        if (!acquired) {
          ctx.log.info('another trial-notifications tick is in flight; skipping');
          metrics.increment('cron.trial_notifications.skipped_locked');
          return { processed: 0, skipped: true as const };
        }

        const trialingSubscriptions = await prisma.subscription.findMany({
          where: { status: 'TRIALING', trialEnd: { not: null } },
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
            ctx.log,
          );
          if (sendResult.skipped) skippedDedup++;
          else notificationCount++;
        }

        return { processed: trialingSubscriptions.length, skipped: false as const };
      },
      { timeout: 60_000, maxWait: 10_000 },
    );

    ctx.log.info(
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

    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: {
        processed: result.processed,
        notificationsSent: notificationCount,
        skippedDedup,
        skippedLocked: result.skipped,
      },
    };
  } catch (err) {
    ctx.log.error({ err }, 'cron handler failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'trial-notifications' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};

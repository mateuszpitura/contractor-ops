/**
 * Trial-end notifications handler.
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
import { normalizeLocale, resolveMessage } from '@contractor-ops/api/i18n/email-i18n';
import { dispatch } from '@contractor-ops/api/services/notification-service';
import { prisma, prismaRaw } from '@contractor-ops/db';
import { Prisma } from '@contractor-ops/db/generated/prisma/client';
import { metrics } from '@contractor-ops/logger/metrics';
import { loadEnv } from '../../env.js';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

const TRIAL_NOTIFICATIONS_LOCK_KEY = 'trial-notifications';

function buildBillingUrl(): string {
  const base = loadEnv().PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base}/settings?tab=billing`;
}

/**
 * Dotted i18n keys into `apps/web-vite/messages/<locale>.json`.
 *
 *   - `titleKey` / `bodyKey` are passed straight to `dispatch()`, whose
 *     `resolveEventCopy` resolves them against the org's `Organization.language`
 *     for the in-app notification + any side channels it owns.
 *   - `emailSubjectKey` / `emailBodyKey` are resolved here via `resolveMessage`
 *     because the trial email is a bespoke `sendAppEmail` HTML send that does
 *     not flow through the React Email pipeline — so the dispatcher never sees
 *     these strings.
 */
interface TrialTemplate {
  titleKey: string;
  bodyKey: string;
  emailSubjectKey: string;
  emailBodyKey: string;
}

const TRIAL_NOTIFICATION_TEMPLATES: Record<number, TrialTemplate> = {
  7: {
    titleKey: 'Notifications.trial.ending7d.title',
    bodyKey: 'Notifications.trial.ending7d.body',
    emailSubjectKey: 'Notifications.trial.email7d.subject',
    emailBodyKey: 'Notifications.trial.email7d.body',
  },
  1: {
    titleKey: 'Notifications.trial.ending1d.title',
    bodyKey: 'Notifications.trial.ending1d.body',
    emailSubjectKey: 'Notifications.trial.email1d.subject',
    emailBodyKey: 'Notifications.trial.email1d.body',
  },
};

const EMAIL_CTA_KEY = 'Notifications.trial.emailCta';

async function sendTrialNotification(
  organization: { id: string; billingEmail: string | null; language: string | null },
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
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { skipped: true };
    }
    throw err;
  }

  if (adminUserIds.length > 0) {
    await dispatch({
      organizationId: organization.id,
      type: 'TRIAL_ENDING',
      recipientUserIds: adminUserIds,
      title: template.titleKey,
      body: template.bodyKey,
      entityType: 'ORGANIZATION',
      entityId: organization.id,
    });
  }

  if (organization.billingEmail) {
    const locale = normalizeLocale(organization.language);
    const subject = resolveMessage(template.emailSubjectKey, locale);
    const body = resolveMessage(template.emailBodyKey, locale);
    const ctaLabel = resolveMessage(EMAIL_CTA_KEY, locale);
    try {
      await sendAppEmail({
        from: 'Contractor Ops <notifications@contractorhub.io>',
        to: organization.billingEmail,
        subject,
        html: `<p>${body}</p><p><a href="${buildBillingUrl()}">${ctaLabel}</a></p>`,
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
                language: true,
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

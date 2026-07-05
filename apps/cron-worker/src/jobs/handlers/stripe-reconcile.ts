/**
 * Daily Stripe subscription reconcile.
 *
 * Webhooks are the primary path for subscription state, but a dropped delivery
 * or a redelivery the ordering guard correctly rejected can still leave a
 * `Subscription` row drifted from Stripe (wrong status or tier). This job is the
 * backstop: it pages through every Stripe subscription and repairs any DB row
 * whose status/tier disagrees with Stripe's current truth.
 *
 * It writes Stripe's value directly (Stripe is the source of truth here) but
 * deliberately does NOT touch `lastEventCreated`, so the webhook out-of-order
 * guard stays intact for subsequent live events. Idempotent — a second run the
 * same day is a no-op because reconciled rows already match.
 */

import { resolveTierFromPriceId } from '@contractor-ops/api/services/billing-constants';
import { stripe } from '@contractor-ops/api/services/stripe-client';
import type { SubscriptionWithPeriod } from '@contractor-ops/billing/webhook';
import { buildSubscriptionData } from '@contractor-ops/billing/webhook';
import { prisma } from '@contractor-ops/db';
import { metrics } from '@contractor-ops/logger/metrics';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

export const stripeReconcileHandler: JobHandler = async ctx => {
  const start = performance.now();
  let scanned = 0;
  let repaired = 0;
  let orphaned = 0;

  try {
    for await (const subscription of stripe.subscriptions.list({ limit: 100, status: 'all' })) {
      scanned++;

      const organizationId = subscription.metadata?.organizationId;
      if (!organizationId) continue;

      const existing = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subscription.id },
        select: { status: true, tier: true },
      });

      if (!existing) {
        orphaned++;
        ctx.log.warn(
          { subscriptionId: subscription.id, organizationId },
          'stripe-reconcile: Stripe subscription has no matching DB row',
        );
        continue;
      }

      const { tier, status, data } = buildSubscriptionData(
        subscription as unknown as SubscriptionWithPeriod,
        organizationId,
        resolveTierFromPriceId,
      );

      if (existing.status === status && existing.tier === tier) continue;

      await prisma.subscription.update({
        where: { stripeSubscriptionId: subscription.id },
        data,
      });
      repaired++;
      ctx.log.info(
        {
          subscriptionId: subscription.id,
          organizationId,
          fromStatus: existing.status,
          toStatus: status,
          fromTier: existing.tier,
          toTier: tier,
        },
        'stripe-reconcile: repaired drifted subscription',
      );
    }

    ctx.log.info({ scanned, repaired, orphaned }, 'stripe-reconcile cron completed');
    metrics.gauge('cron.stripe_reconcile.scanned', scanned);
    metrics.gauge('cron.stripe_reconcile.repaired', repaired);
    metrics.gauge('cron.stripe_reconcile.orphaned', orphaned);

    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: { scanned, repaired, orphaned },
    };
  } catch (err) {
    ctx.log.error({ err }, 'stripe-reconcile cron failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'stripe-reconcile' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};

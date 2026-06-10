import type Stripe from 'stripe';

import type {
  BillingSubscriptionStatus,
  BillingSubscriptionTier,
  SubscriptionUpsertData,
  SubscriptionWithPeriod,
} from './types.js';

export function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const parentSub = invoice.parent?.subscription_details?.subscription;
  if (parentSub) {
    return typeof parentSub === 'string' ? parentSub : parentSub.id;
  }
  return null;
}

export function mapStripeSubscriptionStatus(status: string): BillingSubscriptionStatus {
  const map: Record<string, BillingSubscriptionStatus> = {
    trialing: 'TRIALING',
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    unpaid: 'UNPAID',
    incomplete: 'INCOMPLETE',
    incomplete_expired: 'INCOMPLETE_EXPIRED',
    paused: 'PAUSED',
  };
  return map[status] ?? 'ACTIVE';
}

export function resolveSubscriptionPeriod(subscription: SubscriptionWithPeriod): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000)
    : subscription.start_date
      ? new Date(subscription.start_date * 1000)
      : new Date();

  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : subscription.start_date
      ? new Date((subscription.start_date + 30 * 24 * 60 * 60) * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return { periodStart, periodEnd };
}

export function buildSubscriptionData(
  subscription: SubscriptionWithPeriod,
  organizationId: string,
  resolveTierFromPriceId: (priceId: string) => BillingSubscriptionTier,
  opts?: {
    onUnknownPriceId?: (ctx: {
      priceId: string | undefined;
      subscriptionId: string;
      organizationId: string;
    }) => void;
  },
): {
  tier: BillingSubscriptionTier;
  status: BillingSubscriptionStatus;
  data: SubscriptionUpsertData;
} {
  const status = mapStripeSubscriptionStatus(subscription.status);
  const priceId = subscription.items.data[0]?.price?.id;

  let tier: BillingSubscriptionTier;
  try {
    tier = priceId ? resolveTierFromPriceId(priceId) : 'STARTER';
  } catch {
    opts?.onUnknownPriceId?.({
      priceId,
      subscriptionId: subscription.id,
      organizationId,
    });
    tier = 'STARTER';
  }

  const { periodStart, periodEnd } = resolveSubscriptionPeriod(subscription);

  const data: SubscriptionUpsertData = {
    organizationId,
    stripeCustomerId:
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripeSubscriptionItemId: subscription.items.data[0]?.id ?? null,
    stripePriceId: priceId ?? null,
    tier,
    status,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    seatCount: subscription.items.data[0]?.quantity ?? 1,
  };

  return { tier, status, data };
}

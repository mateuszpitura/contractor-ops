import type Stripe from 'stripe';

import type { BillingWebhookTx } from '../types.js';

/**
 * Marks a subscription as CANCELED. Returns organizationId for cache invalidation
 * by the api-layer wrapper.
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  tx: BillingWebhookTx,
): Promise<{ organizationId: string } | null> {
  const existing = await tx.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true, organizationId: true },
  });

  if (!existing) {
    return null;
  }

  await tx.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: { status: 'CANCELED' },
  });

  return { organizationId: existing.organizationId };
}

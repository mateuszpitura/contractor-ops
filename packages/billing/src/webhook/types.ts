import type Stripe from 'stripe';

export type BillingSubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'UNPAID'
  | 'INCOMPLETE'
  | 'INCOMPLETE_EXPIRED'
  | 'PAUSED';

export type BillingSubscriptionTier = 'STARTER' | 'PRO' | 'ENTERPRISE';

/**
 * Extended Stripe subscription shape that includes period fields.
 * Stripe webhook payloads include current_period_start/end even when
 * the SDK types for newer API versions omit them.
 */
export interface SubscriptionWithPeriod extends Stripe.Subscription {
  current_period_start: number;
  current_period_end: number;
}

export const STRIPE_STATUS_MAP: Record<string, BillingSubscriptionStatus> = {
  trialing: 'TRIALING',
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  unpaid: 'UNPAID',
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'INCOMPLETE_EXPIRED',
  paused: 'PAUSED',
};

export interface SubscriptionUpsertData {
  organizationId: string;
  stripeCustomerId: string;
  stripeSubscriptionItemId: string | null;
  stripePriceId: string | null;
  tier: BillingSubscriptionTier;
  status: BillingSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  seatCount: number;
}

export interface BillingWebhookTx {
  subscription: {
    findUnique: (args: {
      where: { stripeSubscriptionId: string };
      select?: { id: true; organizationId: true };
    }) => Promise<{ id: string; organizationId: string } | null>;
    update: (args: {
      where: { stripeSubscriptionId: string };
      data: { status: BillingSubscriptionStatus };
    }) => Promise<{ organizationId: string }>;
  };
}

export type StripeWebhookHandler<T = Stripe.Event.Data.Object> = (
  payload: T,
  tx: BillingWebhookTx,
) => Promise<{ organizationId: string } | null>;

import type { SubscriptionTier } from '@contractor-ops/db/generated/prisma/client';
import { getServerEnv } from '@contractor-ops/validators';

/** Monthly OCR credit allowance per tier for active subscriptions */
export const TIER_CREDIT_ALLOWANCE: Record<SubscriptionTier, number> = {
  STARTER: 20,
  PRO: 100,
  ENTERPRISE: 500,
} as const;

/** OCR credit allowance for trial subscriptions */
export const TRIAL_CREDIT_ALLOWANCE = 5;

const stripeEnv = getServerEnv();

/**
 * Maps Stripe Price IDs to subscription tiers.
 * Uses env vars so prices are configurable without code changes.
 * Empty/missing env vars are filtered out to prevent "" key collisions.
 */
export const PRICE_TO_TIER_MAP: Record<string, SubscriptionTier> = Object.fromEntries(
  (
    [
      [stripeEnv.STRIPE_PRICE_STARTER, 'STARTER'],
      [stripeEnv.STRIPE_PRICE_PRO, 'PRO'],
      [stripeEnv.STRIPE_PRICE_ENTERPRISE, 'ENTERPRISE'],
    ] as const
  ).filter(([key]) => key),
) as Record<string, SubscriptionTier>;

/** Set of all known subscription price IDs for server-side validation. */
export const KNOWN_SUBSCRIPTION_PRICE_IDS = new Set(Object.keys(PRICE_TO_TIER_MAP));

/** Resolve tier from a Stripe Price ID. Throws if price is unknown. */
export function resolveTierFromPriceId(priceId: string): SubscriptionTier {
  const tier = PRICE_TO_TIER_MAP[priceId];
  if (!tier) {
    throw new Error(`[billing] Unknown Stripe price ID: ${priceId}`);
  }
  return tier;
}

/**
 * Maps top-up Stripe Price IDs to the number of OCR credits they grant.
 * Empty/missing env vars are filtered out to prevent "" key collisions.
 */
export const TOPUP_PRICE_TO_CREDITS: Record<string, number> = Object.fromEntries(
  (
    [
      [stripeEnv.STRIPE_PRICE_TOPUP_10, 10],
      [stripeEnv.STRIPE_PRICE_TOPUP_25, 25],
      [stripeEnv.STRIPE_PRICE_TOPUP_50, 50],
    ] as const
  ).filter(([key]) => key),
);

/** Set of all known top-up price IDs for server-side validation. */
export const KNOWN_TOPUP_PRICE_IDS = new Set(Object.keys(TOPUP_PRICE_TO_CREDITS));

/** Resolve credit count from a top-up Price ID. Returns null if unknown. */
export function resolveTopUpCredits(priceId: string): number | null {
  return TOPUP_PRICE_TO_CREDITS[priceId] ?? null;
}

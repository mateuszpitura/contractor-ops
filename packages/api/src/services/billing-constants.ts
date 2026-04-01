import type { SubscriptionTier } from "@contractor-ops/db/generated/prisma/client";

/** Monthly OCR credit allowance per tier for active subscriptions (D-06) */
export const TIER_CREDIT_ALLOWANCE: Record<SubscriptionTier, number> = {
  STARTER: 20,
  PRO: 100,
  ENTERPRISE: 500,
} as const;

/** OCR credit allowance for trial subscriptions per D-08 */
export const TRIAL_CREDIT_ALLOWANCE = 5;

/**
 * Maps Stripe Price IDs to subscription tiers.
 * Uses env vars so prices are configurable without code changes.
 */
export const PRICE_TO_TIER_MAP: Record<string, SubscriptionTier> = {
  [process.env.STRIPE_PRICE_STARTER ?? ""]: "STARTER",
  [process.env.STRIPE_PRICE_PRO ?? ""]: "PRO",
  [process.env.STRIPE_PRICE_ENTERPRISE ?? ""]: "ENTERPRISE",
};

/** Resolve tier from a Stripe Price ID. Throws if price is unknown. */
export function resolveTierFromPriceId(priceId: string): SubscriptionTier {
  const tier = PRICE_TO_TIER_MAP[priceId];
  if (!tier) {
    throw new Error(`[billing] Unknown Stripe price ID: ${priceId}`);
  }
  return tier;
}

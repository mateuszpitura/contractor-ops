import type { SubscriptionTier } from '@contractor-ops/db/generated/prisma/client';

// ---------------------------------------------------------------------------
// Per-tier limits for the public REST API (single source of truth).
// ---------------------------------------------------------------------------
//
// Two independent limits, one table:
//   * TIER_MONTHLY_REQUEST_QUOTA — enforced now by `enforceApiTierQuota`
//     (post-auth monthly counter). Composes with the pre-auth flat burst limiter
//     (`apps/public-api/src/lib/rate-limiter.ts`): burst = DoS, monthly = billing.
//   * TIER_WEBHOOK_SUBSCRIPTION_CAP — DEFINED here, CONSUMED in Phase 100 (webhook
//     subscriptions do not exist yet).
//
// All public keys currently require the ENTERPRISE tier, so the STARTER/PRO
// quotas are latent-but-correct until product opens the public API to lower tiers.

/** Requests allowed per calendar month, per subscription tier. */
export const TIER_MONTHLY_REQUEST_QUOTA: Record<SubscriptionTier, number> = {
  STARTER: 1_000,
  PRO: 10_000,
  ENTERPRISE: Number.POSITIVE_INFINITY,
};

/** Max concurrent webhook subscriptions per tier (Phase 100 consumes this). */
export const TIER_WEBHOOK_SUBSCRIPTION_CAP: Record<SubscriptionTier, number> = {
  STARTER: 1,
  PRO: 5,
  ENTERPRISE: Number.POSITIVE_INFINITY,
};

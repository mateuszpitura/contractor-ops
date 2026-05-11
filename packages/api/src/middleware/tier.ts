import type { SubscriptionTier } from '@contractor-ops/db/generated/prisma/client';
import { TRPCError } from '@trpc/server';
import { t } from '../init';
import { getSubscription } from '../services/billing-service';
import { tenantProcedure } from './tenant';

// ---------------------------------------------------------------------------
// Tier ranking for comparison
// ---------------------------------------------------------------------------

const TIER_RANK: Record<SubscriptionTier, number> = {
  STARTER: 1,
  PRO: 2,
  ENTERPRISE: 3,
};

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * tRPC middleware factory that gates procedures by subscription tier.
 *
 * Performs a lazy per-request check via `getSubscription` (cached in Redis).
 * Rejects with a structured TIER_REQUIRED error containing both the required
 * and current tier for client-side upgrade prompts.
 *
 * @param minimumTier - The minimum subscription tier required to access the procedure
 * @returns tRPC middleware that adds `subscription` to context on success
 */
export function requireTier(minimumTier: SubscriptionTier) {
  return t.middleware(async ({ ctx, next }) => {
    const sub = await getSubscription(
      (ctx as unknown as { organizationId: string }).organizationId,
    );

    // No subscription or inactive status
    if (!sub || (sub.status !== 'ACTIVE' && sub.status !== 'TRIALING')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: JSON.stringify({
          type: 'TIER_REQUIRED',
          requiredTier: minimumTier,
          currentTier: null,
        }),
      });
    }

    // Tier rank insufficient
    if (TIER_RANK[sub.tier as SubscriptionTier] < TIER_RANK[minimumTier]) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: JSON.stringify({
          type: 'TIER_REQUIRED',
          requiredTier: minimumTier,
          currentTier: sub.tier,
        }),
      });
    }

    return next({
      ctx: { subscription: sub },
    });
  });
}

// ---------------------------------------------------------------------------
// Convenience procedures
// ---------------------------------------------------------------------------

/**
 * Procedure requiring PRO or higher subscription tier.
 * Chain: auth -> tenant -> requireTier(PRO) -> handler
 */
export const proProcedure = tenantProcedure.use(requireTier('PRO'));

/**
 * Procedure requiring ENTERPRISE subscription tier.
 * Chain: auth -> tenant -> requireTier(ENTERPRISE) -> handler
 */
export const enterpriseProcedure = tenantProcedure.use(requireTier('ENTERPRISE'));

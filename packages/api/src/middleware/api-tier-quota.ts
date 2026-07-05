import { TRPCError } from '@trpc/server';
import * as E from '../errors';
import { t } from '../init';
import { TIER_MONTHLY_REQUEST_QUOTA } from '../lib/api-tier-limits';
import { incrementMonthlyRequestCount } from '../services/api-quota-counter';
import { getSubscription } from '../services/billing-service';

// ---------------------------------------------------------------------------
// Post-auth per-tier monthly request quota.
// ---------------------------------------------------------------------------
//
// Runs INSIDE apiKeyTenantProcedure, after auth/flag so the org + tier are
// resolved. Composes with the pre-auth flat burst limiter (two limiters, two
// jobs). ENTERPRISE (unlimited) short-circuits without writing a counter.

/**
 * Enforce the calling org's monthly request quota for its subscription tier.
 * Over-quota → TOO_MANY_REQUESTS (429). Unlimited tiers never touch the counter.
 */
export const enforceApiTierQuota = t.middleware(async ({ ctx, next }) => {
  const { organizationId } = ctx as unknown as { organizationId: string };

  const subscription = await getSubscription(organizationId);
  const tier = subscription?.tier ?? 'STARTER';
  const limit = TIER_MONTHLY_REQUEST_QUOTA[tier];

  // Unlimited (Enterprise): never write a counter.
  if (!Number.isFinite(limit)) {
    return next();
  }

  const count = await incrementMonthlyRequestCount(organizationId);
  if (count > limit) {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: E.API_QUOTA_EXCEEDED });
  }

  return next();
});

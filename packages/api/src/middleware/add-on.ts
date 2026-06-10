import { TRPCError } from '@trpc/server';
import type { AddOnKey } from '../constants/add-ons';
import { ADD_ON_KEYS } from '../constants/add-ons';
import { t } from '../init';
import { getSubscription } from '../services/billing-service';
import { tenantProcedure } from './tenant';
import { requireTier } from './tier';

export type { AddOnKey };
export { ADD_ON_KEYS };

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * tRPC middleware factory that gates procedures by add-on entitlement.
 *
 * Clones the requireTier pattern: a lazy per-request check via the same
 * Redis-cached `getSubscription`, so `addOns` rides along on the cached
 * Subscription with no extra query. Composes AFTER `requireTier` in the
 * chain. Rejects with a structured ADD_ON_REQUIRED error carrying the
 * required add-on and the org's current add-ons for client-side upgrade prompts.
 *
 * @param addOn - The add-on key required to access the procedure
 * @returns tRPC middleware that adds `subscription` to context on success
 */
export function requireAddOn(addOn: AddOnKey) {
  return t.middleware(async ({ ctx, next }) => {
    const sub = await getSubscription(
      (ctx as unknown as { organizationId: string }).organizationId,
    );

    const currentAddOns = sub?.addOns ?? [];
    if (!currentAddOns.includes(addOn)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: JSON.stringify({
          type: 'ADD_ON_REQUIRED',
          requiredAddOn: addOn,
          currentAddOns,
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
 * Procedure gating the Workforce add-on (Theme B surfaces).
 * Chain: auth -> tenant -> requireTier(STARTER) -> requireAddOn(workforce) -> handler.
 * STARTER floor = "any active subscription"; the add-on is tier-independent.
 */
export const workforceProcedure = tenantProcedure
  .use(requireTier('STARTER'))
  .use(requireAddOn('workforce'));

/**
 * Procedure gating the US Cross-Border add-on (Theme A surfaces).
 * Chain: auth -> tenant -> requireTier(STARTER) -> requireAddOn(us-cross-border) -> handler.
 */
export const usCrossBorderProcedure = tenantProcedure
  .use(requireTier('STARTER'))
  .use(requireAddOn('us-cross-border'));

import type { FlagKey, FlagValues } from '@contractor-ops/feature-flags';
import { FLAG_KEYS, FLAGS } from '@contractor-ops/feature-flags';
import { TRPCError } from '@trpc/server';
import { router } from '../../init';
import { tenantFlaggedProcedure } from '../../middleware/feature-flag';

/**
 * Feature flag introspection router (session auth).
 *
 * Used by the web app to hydrate the client-side flag bag and to power any
 * future in-app admin views. Write operations (flipping toggles) are NOT
 * exposed here — Unleash's own UI is the control plane for v1.
 *
 * Reading the full flag matrix is a cross-tenant operation, so it is gated
 * to Better Auth platform admins (`User.role === 'admin'`). Org-level
 * roles never expose this surface.
 */
export const featureFlagsRouter = router({
  /**
   * Returns every declared flag with its resolved value for the caller's
   * tenant context. The `reason` property is omitted intentionally; clients
   * don't need it. For debugging, use the public-api `/v1/feature-flags`
   * endpoint which mirrors the same shape.
   */
  list: tenantFlaggedProcedure.query(({ ctx }) => {
    if (ctx.user.role !== 'admin') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'PLATFORM_ADMIN_REQUIRED' });
    }
    return FLAG_KEYS.map(key => ({
      key,
      description: FLAGS[key].description,
      category: FLAGS[key].category,
      jurisdiction: FLAGS[key].jurisdiction,
      enabled: ctx.flags.isEnabled(key),
    }));
  }),

  /**
   * Session-scoped flag bag for client hydration. Any authenticated org member
   * can read resolved booleans for their tenant — unlike `list`, which is
   * platform-admin metadata introspection.
   */
  getBag: tenantFlaggedProcedure.query(({ ctx }) => {
    return FLAG_KEYS.reduce<FlagValues>((acc, key) => {
      acc[key as FlagKey] = ctx.flags.isEnabled(key);
      return acc;
    }, {} as FlagValues);
  }),
});

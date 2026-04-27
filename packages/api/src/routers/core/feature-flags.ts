import { FLAG_KEYS, FLAGS } from '@contractor-ops/feature-flags';
import { router } from '../init.js';
import { tenantFlaggedProcedure } from '../middleware/feature-flag.js';

/**
 * Feature flag introspection router (session auth).
 *
 * Used by the web app to hydrate the client-side flag bag and to power any
 * future in-app admin views. Write operations (flipping toggles) are NOT
 * exposed here — Unleash's own UI is the control plane for v1.
 */
export const featureFlagsRouter = router({
  /**
   * Returns every declared flag with its resolved value for the caller's
   * tenant context. The `reason` property is omitted intentionally; clients
   * don't need it. For debugging, use the public-api `/v1/feature-flags`
   * endpoint which mirrors the same shape.
   */
  list: tenantFlaggedProcedure.query(({ ctx }) => {
    return FLAG_KEYS.map(key => ({
      key,
      description: FLAGS[key].description,
      category: FLAGS[key].category,
      jurisdiction: FLAGS[key].jurisdiction,
      enabled: ctx.flags.isEnabled(key),
    }));
  }),
});

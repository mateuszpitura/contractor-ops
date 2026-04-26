import { FLAG_KEYS, FLAGS } from '@contractor-ops/feature-flags';
import { router } from '../../init.js';
import { apiKeyTenantFlaggedProcedure } from '../../middleware/feature-flag.js';

/**
 * Public API feature flag introspection.
 *
 * Lets integration partners see which flags are enabled for their organization
 * so they can adjust their API usage (e.g. skip endpoints that would return 404
 * because the underlying feature is gated off for their org).
 */
export const publicFeatureFlagsRouter = router({
  list: apiKeyTenantFlaggedProcedure.query(({ ctx }) => {
    return FLAG_KEYS.map(key => ({
      key,
      description: FLAGS[key].description,
      enabled: ctx.flags.isEnabled(key),
    }));
  }),
});

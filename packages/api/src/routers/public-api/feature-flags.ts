import { FLAG_KEYS, FLAGS } from '@contractor-ops/feature-flags';
import { router } from '../../init';
import { apiKeyTenantFlaggedProcedure } from '../../middleware/feature-flag';

/**
 * Public API feature flag introspection.
 *
 * Lets integration partners see which flags are enabled for their organization
 * so they can adjust their API usage (e.g. skip endpoints that would return 404
 * because the underlying feature is gated off for their org).
 *
 * Consumer: `apps/public-api/src/routes/feature-flags.ts` (GET /v1/feature-flags)
 * builds a caller against `publicApiRouter` and invokes `featureFlags.list`. No
 * FE caller — that's served by the appRouter sibling at
 * `routers/core/feature-flags.ts`, now wired into the Settings → Feature flags
 * tab. Tagged `orphan-intentional-non-ui` by the FE↔BE audit's triage step
 * (Signal #2: strong `caller.featureFlags.list` reference in apps/public-api,
 * combined with the procedure living under routers/public-api/).
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

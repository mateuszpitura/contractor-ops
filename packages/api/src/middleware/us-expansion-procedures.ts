import { t } from '../init';
import { usCrossBorderProcedure } from './add-on';
import { assertUsExpansionEnabled } from './require-us-expansion-flag';

const usExpansionFlagMiddleware = t.middleware(({ ctx, next }) => {
  const tenantCtx = ctx as typeof ctx & { organizationId: string; region: string };
  assertUsExpansionEnabled(tenantCtx.organizationId, tenantCtx.region);
  return next();
});

/** US cross-border — STARTER tier + us-cross-border add-on + module flag. */
export const usExpansionProcedure = usCrossBorderProcedure.use(usExpansionFlagMiddleware);

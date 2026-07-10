import { t } from '../init';
import { workforceProcedure } from './add-on';
import { requirePermission } from './rbac';
import { assertWorkforceEnabled } from './require-workforce-flag';

export const workforceFlagMiddleware = t.middleware(({ ctx, next }) => {
  const tenantCtx = ctx as typeof ctx & { organizationId: string; region: string };
  assertWorkforceEnabled(tenantCtx.organizationId, tenantCtx.region);
  return next();
});

/** Workforce read surface — tier + add-on + module flag + employee:read. */
export const workforceReadProcedure = workforceProcedure
  .use(workforceFlagMiddleware)
  .use(requirePermission({ employee: ['read'] }));

/** Workforce write surface — tier + add-on + module flag + employee:update. */
export const workforceWriteProcedure = workforceProcedure
  .use(workforceFlagMiddleware)
  .use(requirePermission({ employee: ['update'] }));

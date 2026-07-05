// Defense-in-depth flag guard for the staff HR command dashboard surface.
//
// The HR dashboard ships dark behind `module.hr-dashboard`, layered on
// `module.workforce-employees` (its data prerequisite). Two enforcement layers:
//   1. Conditional root.ts registration — the hrDashboard.* procedures are
//      absent from appRouter when either flag is OFF (METHOD_NOT_FOUND).
//   2. This per-request middleware — re-evaluates `module.hr-dashboard` for the
//      caller's org / region at request time and throws FORBIDDEN before any
//      aggregation runs.

import { evaluate } from '@contractor-ops/feature-flags';
import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { HR_DASHBOARD_DISABLED } from '../errors';
import { t } from '../init';

const log = createLogger({ service: 'hr-dashboard-flag-guard' });

/**
 * tRPC middleware asserting `module.hr-dashboard` is enabled for the caller's
 * org/region; throws FORBIDDEN otherwise. Chained after tenantProcedure so
 * `ctx.organizationId` / `ctx.region` are already resolved.
 */
export const assertHrDashboardEnabled = t.middleware(async ({ ctx, next }) => {
  const { organizationId, region } = ctx as { organizationId?: string; region?: string };
  if (!organizationId) {
    // Defensive — tenantProcedure upstream should already have rejected.
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  const evalRegion = region === 'ME' ? ('ME' as const) : ('EU' as const);

  const result = evaluate('module.hr-dashboard', { organizationId, region: evalRegion });
  if (!result.enabled) {
    log.warn(
      { organizationId, reason: result.reason, flag: 'module.hr-dashboard' },
      'HR dashboard procedure blocked: flag disabled',
    );
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: HR_DASHBOARD_DISABLED,
      cause: { flag: 'module.hr-dashboard', reason: result.reason },
    });
  }

  return next();
});

/**
 * Module-level evaluation mirroring the workforce gate: decides whether the
 * hrDashboard.* procedures are spread into appRouter at boot. A QA walk org
 * (QA_DEFAULT_ORG_ID) force-registers them; production never sets it.
 */
export function isHrDashboardRegistered(): boolean {
  const base = evaluate('module.hr-dashboard', { organizationId: 'ROOT', region: 'EU' });
  return base.enabled || Boolean(process.env.QA_DEFAULT_ORG_ID);
}

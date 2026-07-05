import { router } from './init';
import { isEmployeePortalRegistered } from './middleware/require-employee-portal-flag';
import {
  portalEmployeeRouter,
  portalManagerRouter,
  portalRouter,
  portalTimeRouter,
} from './routers/portal/index';

/**
 * Separate tRPC router for the contractor portal.
 *
 * Uses `portalProcedure` middleware (cookie-based contractor session) — completely
 * isolated from the staff `tenantProcedure` auth flow. Mounted at /api/trpc/portal.
 *
 * Reason for the split: keeping portal procedures out of the main `appRouter`
 * keeps the merged `AppRouter` type smaller, dramatically reducing TypeScript
 * inference cost for the dashboard client (which never calls portal procedures).
 */
// The employee self-service surface (employee + manager) ships dark behind
// `module.employee-portal`. Mirror the staff conditionalWorkforceRouters gate:
// both namespaces are absent from portalAppRouter at boot when the flag is
// unregistered (METHOD_NOT_FOUND); the const keeps the spread TYPE constant so
// the client typing always sees them. portalEmployeeProcedure /
// portalManagerProcedure re-assert the flag (and, for manager, ≥1 report) per
// request.
const conditionalEmployeePortalRouters = isEmployeePortalRegistered()
  ? { portalEmployee: portalEmployeeRouter, portalManager: portalManagerRouter }
  : ({} as {
      portalEmployee: typeof portalEmployeeRouter;
      portalManager: typeof portalManagerRouter;
    });

export const portalAppRouter = router({
  portal: portalRouter,
  portalTime: portalTimeRouter,
  ...conditionalEmployeePortalRouters,
});

/** Type-safe portal router type for portal client consumption */
export type PortalAppRouter = typeof portalAppRouter;

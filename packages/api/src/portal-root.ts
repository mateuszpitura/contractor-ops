import { router } from './init';
import { isEmployeePortalRegistered } from './middleware/require-employee-portal-flag';
import { portalEmployeeRouter, portalRouter, portalTimeRouter } from './routers/portal/index';

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
// The employee self-service surface ships dark behind `module.employee-portal`.
// Mirror the staff conditionalWorkforceRouters gate: portalEmployee is absent
// from portalAppRouter at boot when the flag is unregistered (METHOD_NOT_FOUND);
// the const keeps the spread TYPE constant so the client typing always sees the
// namespace. portalEmployeeProcedure re-asserts the flag per request.
const conditionalEmployeePortalRouters = isEmployeePortalRegistered()
  ? { portalEmployee: portalEmployeeRouter }
  : ({} as { portalEmployee: typeof portalEmployeeRouter });

export const portalAppRouter = router({
  portal: portalRouter,
  portalTime: portalTimeRouter,
  ...conditionalEmployeePortalRouters,
});

/** Type-safe portal router type for portal client consumption */
export type PortalAppRouter = typeof portalAppRouter;

import { router } from './init.js';
import { portalRouter, portalTimeRouter } from './routers/portal/index.js';

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
export const portalAppRouter = router({
  portal: portalRouter,
  portalTime: portalTimeRouter,
});

/** Type-safe portal router type for portal client consumption */
export type PortalAppRouter = typeof portalAppRouter;

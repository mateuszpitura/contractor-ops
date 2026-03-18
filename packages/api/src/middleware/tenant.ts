import { TRPCError } from "@trpc/server";
import { tenantStore } from "@contractor-ops/db";
import { t } from "../init";
import { authedProcedure } from "./auth";

/**
 * Tenant middleware: enforces an active organization and sets up
 * the AsyncLocalStorage context for tenant-scoped database queries.
 *
 * Must be chained after auth middleware (session must exist in ctx).
 * Throws FORBIDDEN if no active organization is set in the session.
 */
const tenantMiddleware = t.middleware(async ({ ctx, next }) => {
  // ctx is typed by the procedure chain — session comes from auth middleware
  const session = (ctx as unknown as { session: { session: { activeOrganizationId?: string | null } } }).session;
  const orgId = session.session.activeOrganizationId;

  if (!orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active organization. Please select an organization first.",
    });
  }

  return tenantStore.run({ organizationId: orgId }, () =>
    next({ ctx: { ...ctx, organizationId: orgId } }),
  );
});

/**
 * Procedure that requires authentication + active organization.
 * Chain: auth -> tenant -> handler
 */
export const tenantProcedure = authedProcedure.use(tenantMiddleware);

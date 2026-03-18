import { TRPCError } from "@trpc/server";
import { tenantStore } from "@contractor-ops/db";
import { t } from "../init.js";
import { authedProcedure } from "./auth.js";

/**
 * Tenant middleware: enforces an active organization and sets up
 * the AsyncLocalStorage context for tenant-scoped database queries.
 *
 * Must be chained after auth middleware (session must exist in ctx).
 * Throws FORBIDDEN if no active organization is set in the session.
 * Wraps the handler in tenantStore.run() so Prisma Client Extension
 * can automatically scope all queries to the active organization.
 */
const tenantMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const orgId = ctx.session.session.activeOrganizationId;

  if (!orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active organization. Please select an organization first.",
    });
  }

  return tenantStore.run({ organizationId: orgId }, () =>
    next({
      ctx: { ...ctx, organizationId: orgId },
    }),
  );
});

/**
 * Procedure that requires authentication + active organization.
 * Chain: auth -> tenant -> handler
 */
export const tenantProcedure = authedProcedure.use(tenantMiddleware);

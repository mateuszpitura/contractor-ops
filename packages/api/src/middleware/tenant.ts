import { createTenantClientFrom, getRegionalClient, prisma, tenantStore } from "@contractor-ops/db";
import { TRPCError } from "@trpc/server";
import { t } from "../init.js";
import { authedProcedure } from "./auth.js";

/**
 * Tenant middleware: enforces an active organization, resolves its data region,
 * and sets up the AsyncLocalStorage context with a region-aware Prisma client.
 *
 * Must be chained after auth middleware (session must exist in ctx).
 * Throws FORBIDDEN if no active organization is set in the session.
 *
 * Flow:
 * 1. Resolve orgId from session
 * 2. Look up org's dataRegion from primary (EU) database
 * 3. Get the regional PrismaClient for that region
 * 4. Apply tenant scope + soft-delete extensions
 * 5. Set regional client in context as ctx.db
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

  // Look up org's data region from the primary (EU) database.
  // Organization table always lives in the primary region — it's the routing table.
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { dataRegion: true },
  });
  const region = org?.dataRegion ?? "EU";

  // Get the regional Prisma client and apply tenant + soft-delete extensions
  const regionalPrisma = getRegionalClient(region);
  const scopedClient = createTenantClientFrom(regionalPrisma);

  return tenantStore.run({ organizationId: orgId, region }, () =>
    next({
      ctx: { ...ctx, organizationId: orgId, region, db: scopedClient },
    }),
  );
});

/**
 * Procedure that requires authentication + active organization.
 * Chain: auth -> tenant -> handler
 *
 * Provides ctx.db (region-aware, tenant-scoped Prisma client) and ctx.region.
 */
export const tenantProcedure = authedProcedure.use(tenantMiddleware);

import { createTenantClientFrom, getRegionalClient, prisma, tenantStore } from '@contractor-ops/db';
import { TRPCError } from '@trpc/server';
import { t } from '../init.js';
import { authedProcedure } from './auth.js';

// ---------------------------------------------------------------------------
// Shared tenant context setup — reusable across session & API key auth flows
// ---------------------------------------------------------------------------

/**
 * Resolves an organization's data region, creates a tenant-scoped Prisma client,
 * and runs the callback inside AsyncLocalStorage with the tenant context set.
 *
 * This is the shared core extracted from tenantMiddleware so that both
 * session-based and API-key-based auth flows can establish tenant context
 * without duplicating the region lookup + client setup logic.
 */
export async function runWithTenantContext<T>(
  orgId: string,
  fn: (ctx: {
    organizationId: string;
    region: string;
    db: ReturnType<typeof createTenantClientFrom>;
  }) => Promise<T>,
  /** Pre-resolved data region — skips the DB lookup when available. */
  knownRegion?: string,
): Promise<T> {
  let region = knownRegion;

  if (!region) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { dataRegion: true },
    });
    region = org?.dataRegion ?? 'EU';
  }

  const regionalPrisma = getRegionalClient(region);
  const scopedClient = createTenantClientFrom(regionalPrisma);

  return tenantStore.run({ organizationId: orgId, region }, () =>
    fn({ organizationId: orgId, region, db: scopedClient }),
  );
}

// ---------------------------------------------------------------------------
// Tenant middleware (session-based)
// ---------------------------------------------------------------------------

/**
 * Tenant middleware: enforces an active organization, resolves its data region,
 * and sets up the AsyncLocalStorage context with a region-aware Prisma client.
 *
 * Must be chained after auth middleware (session must exist in ctx).
 * Throws FORBIDDEN if no active organization is set in the session.
 */
const tenantMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!(ctx.session && ctx.user)) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const orgId = ctx.session.session.activeOrganizationId;

  if (!orgId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'errors.tenant.noActiveOrganization',
    });
  }

  return runWithTenantContext(orgId, async tenantCtx => next({ ctx: { ...ctx, ...tenantCtx } }));
});

/**
 * Procedure that requires authentication + active organization.
 * Chain: auth -> tenant -> handler
 *
 * Provides ctx.db (region-aware, tenant-scoped Prisma client) and ctx.region.
 */
export const tenantProcedure = authedProcedure.use(tenantMiddleware);

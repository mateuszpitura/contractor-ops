import type { createTenantClientFrom, PrismaClient } from '@contractor-ops/db';

/**
 * Regional Prisma client: tenant scope + soft-delete extensions on the region’s DB
 * (`getRegionalClient` → `createTenantClientFrom`). This is what `ctx.db` is — use it for
 * all org data in tenant procedures; do not substitute the primary `prisma` singleton.
 */
export type TenantScopedDb = ReturnType<typeof createTenantClientFrom<PrismaClient>>;

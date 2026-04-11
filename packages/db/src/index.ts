export { prisma, PrismaClient, createPrismaClientForUrl } from "./client.js";
export { withTenantScope, tenantStore } from "./tenant.js";
export { withSoftDelete } from "./soft-delete.js";
export { withRlsSession } from "./rls.js";
export type { RlsContext } from "./rls.js";
export { getRegionalClient, preWarmRegionalClients, SUPPORTED_REGIONS } from "./region.js";
export type { DataRegion } from "./region.js";

export type { Prisma } from "../generated/prisma/client/index.js";

import { prisma as basePrisma } from "./client.js";
import { withSoftDelete } from "./soft-delete.js";
import { withTenantScope, type PrismaExtensible } from "./tenant.js";

/**
 * Creates a tenant-scoped Prisma client with soft-delete support.
 * Use tenantStore.run({ organizationId }, callback) to set the tenant context
 * before executing queries.
 */
export function createTenantClient() {
  return withSoftDelete(withTenantScope(basePrisma));
}

/**
 * Applies tenant scope + soft-delete extensions to an existing Prisma client
 * (useful for `prisma.$transaction(async (tx) => ...)` where `tx` is the client).
 */
export function createTenantClientFrom<T extends PrismaExtensible>(prisma: T) {
  return withSoftDelete(withTenantScope(prisma));
}

export { prisma, PrismaClient } from "./client.js";
export { withTenantScope, tenantStore } from "./tenant.js";
export { withSoftDelete } from "./soft-delete.js";

export type { Prisma } from "../generated/prisma/client/index.js";

/**
 * Creates a tenant-scoped Prisma client with soft-delete support.
 * Use tenantStore.run({ organizationId }, callback) to set the tenant context
 * before executing queries.
 */
export function createTenantClient() {
  // Lazy import to avoid circular dependencies
  const { prisma: basePrisma } = require("./client.js");
  const { withTenantScope: applyTenantScope } = require("./tenant.js");
  const { withSoftDelete: applySoftDelete } = require("./soft-delete.js");

  return applySoftDelete(applyTenantScope(basePrisma));
}

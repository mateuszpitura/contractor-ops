export { prisma, PrismaClient } from "./client";
export { withTenantScope, tenantStore } from "./tenant";
export { withSoftDelete } from "./soft-delete";

export type { Prisma } from "../generated/prisma/client";

/**
 * Creates a tenant-scoped Prisma client with soft-delete support.
 * Use tenantStore.run({ organizationId }, callback) to set the tenant context
 * before executing queries.
 */
export function createTenantClient() {
  // Uses synchronous imports to avoid type gymnastics
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { prisma: basePrisma } = require("./client");
  const { withTenantScope: applyTenantScope } = require("./tenant");
  const { withSoftDelete: applySoftDelete } = require("./soft-delete");

  return applySoftDelete(applyTenantScope(basePrisma));
}

export { createPrismaClientForUrl, PrismaClient, prisma } from './client.js';
export type {
  ContractType,
  Prisma,
  TaxIdType,
  ValidationStatus,
} from './generated/prisma/client/client.js';
// PHASE-60-CROSS-ORG-AGGREGATE: raw (non-tenant-scoped) client for cron-only cross-org aggregates.
export { prismaRaw } from './raw.js';
export type { DataRegion } from './region.js';
export { getRegionalClient, preWarmRegionalClients, SUPPORTED_REGIONS } from './region.js';
export type { RlsContext } from './rls.js';
export { withRlsSession } from './rls.js';
export {
  capabilityEnumSchema,
  providerIdSchema,
  type ScopeCapabilitiesParsed,
  scopeCapabilitiesSchema,
} from './scope-capabilities-schema.js';
export { withSoftDelete } from './soft-delete.js';
export { tenantStore, withTenantScope } from './tenant.js';
export type { CapabilityEnum, ProviderId, ScopeCapabilities } from './types/scope-capabilities.js';

import { prisma as basePrisma } from './client.js';
import { withSoftDelete } from './soft-delete.js';
import type { PrismaExtensible } from './tenant.js';
import { withTenantScope } from './tenant.js';

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

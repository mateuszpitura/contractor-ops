// ---------------------------------------------------------------------------
// F-SCALE-06 — read-replica routing (Phase 3 Tier-2)
// ---------------------------------------------------------------------------
//
// Per-region read replicas are wired in `replica.ts`. They are **opt-in**:
// when `DATABASE_URL_<REGION>_RO` is set the replica client is available via
// `getReplicaClient(region)` / `readReplica(region, fn)`; otherwise these
// helpers transparently return the writer from `getRegionalClient`.
//
// `getRegionalClient` (writer) and `getReplicaClient` (read replica) compose
// — they share `createPrismaClientForUrl` for client construction and never
// mix their pools. Mutations and `$transaction` always go through the
// writer; only call sites that explicitly opt into replica reads route there.
//
// First consumer: `dashboard.kpis` (see `packages/api/src/routers/core/
// dashboard.ts`). Subsequent consumers should review the lag tolerance
// notes in `replica.ts` before opting in.

export { createPrismaClientForUrl, PrismaClient, prisma } from './client.js';
export type {
  ContractType,
  NitaqatBand,
  Prisma,
  TaxIdType,
  ValidationStatus,
} from './generated/prisma/client/client.js';
// PHASE-60-CROSS-ORG-AGGREGATE: raw (non-tenant-scoped) client for cron-only cross-org aggregates.
export { prismaRaw } from './raw.js';
export type { DataRegion } from './region.js';
export { getRegionalClient, preWarmRegionalClients, SUPPORTED_REGIONS } from './region.js';
// F-SCALE-06 — opt-in read-replica routing with circuit-breaker fallback.
export { getReplicaClient, readReplica, resetReplicaStateForTests } from './replica.js';
export type { PrismaWithTransaction, RlsContext, RlsReadScopedModel } from './rls.js';
export {
  RLS_READ_SCOPED_MODELS,
  withRlsReads,
  withRlsSession,
  withRlsTransactions,
} from './rls.js';
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

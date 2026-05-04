// ---------------------------------------------------------------------------
// F-SCALE-06 — read-replica routing (deferred to Tier 2 follow-up)
// ---------------------------------------------------------------------------
//
// Status: NOT IMPLEMENTED. Deferred from Phase 3 sweep S3-4 because the
// design surface is materially larger than a sweep-style fix:
//
//   - Add `DATABASE_URL_EU_RO` / `DATABASE_URL_ME_RO` env (pair per region).
//   - Construct a second `PrismaClient` per region (replica) alongside the
//     existing writer in `region.ts`.
//   - Use Prisma 7 `client.$extends({ replica })` (or a custom router) to
//     route `query` operations to the replica and `mutation` operations to
//     the writer. The audit's call-out paths (`report.spendByContractor`,
//     `report.spendByTeam`, `report.spend*Chart`, `report.complianceGapsChart`,
//     `dashboard.kpis`, `search.global`, `audit.list`, `audit.export`) all
//     go through `tenantProcedure` whose `runWithTenantContext` resolves
//     `ctx.db` — that is the choke-point where read/write split must wire
//     in, with replica-aware client returned for read-only procedures.
//   - Fail-over: when the replica errors with connection-refused or replica
//     lag exceeds an acceptable threshold, downgrade to the writer for the
//     current request and surface a Pino warn line with the lag value.
//   - Lag tolerance per query: dashboard KPIs tolerate a few seconds; audit
//     export must read-after-write. Add a small per-procedure annotation so
//     mutate-then-read flows don't read stale.
//
// Until that lands, every read goes to the writer. At 200+ concurrent
// dashboard users the writer's CPU will spike and slow down writes. The
// dashboard.kpis Redis-backed singleflight (P2-F · F-SCALE-11) absorbs the
// burst case but reporting endpoints (large GROUP BY scans) are still
// writer-bound.
//
// Tracking: upgraded to Tier 2 follow-up. Any change to `region.ts` /
// `tenant.ts` that touches client construction should retain a clear seam
// for the eventual replica injection.

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
export type { PrismaWithTransaction, RlsContext } from './rls.js';
export { withRlsSession, withRlsTransactions } from './rls.js';
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

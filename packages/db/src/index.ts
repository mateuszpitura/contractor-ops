// ---------------------------------------------------------------------------
// Read-replica routing
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
  EmployeeDocCategory,
  EmploymentType,
  NitaqatBand,
  Prisma,
  TaxIdType,
  ValidationStatus,
} from './generated/prisma/client/client.js';
// Raw (non-tenant-scoped) client for cron-only cross-org aggregates.
export { prismaRaw } from './raw.js';
export type { DataRegion, RegionalFindResult } from './region.js';
export {
  findAcrossRegions,
  getRegionalClient,
  preWarmRegionalClients,
  resolveOrganizationRegion,
  SUPPORTED_REGIONS,
  tryGetRegionalClient,
} from './region.js';
// Opt-in read-replica routing with circuit-breaker fallback.
export { getReplicaClient, readReplica, resetReplicaStateForTests } from './replica.js';
// Statutory retention resolver shared by the three deletion chokepoints
// (soft-delete extension, data-purge cron, gdpr erasure).
export type {
  PersonnelRetentionDates,
  PersonnelRetentionResult,
  PersonnelRetentionRuleInput,
  RetainedRecordType,
  RetentionAnchor,
} from './retention-policy.js';
export {
  getPersonnelRetentionCutoff,
  getRetentionCutoff,
  MODEL_RETENTION_TYPE,
  RETENTION_YEARS,
  resolveRetentionYears,
} from './retention-policy.js';
export type { PrismaWithTransaction, RlsContext, RlsReadScopedModel } from './rls.js';
export {
  allowAuditPurge,
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
export { withWorkerTypeDefault } from './worker-type.js';

import { prisma as basePrisma } from './client.js';
import { withSoftDelete } from './soft-delete.js';
import type { PrismaExtensible } from './tenant.js';
import { withTenantScope } from './tenant.js';
import { withWorkerTypeDefault } from './worker-type.js';

/**
 * Creates a tenant-scoped Prisma client with soft-delete support and the
 * worker-type default. The extension order is load-bearing: worker-type is
 * outermost so the `workerType = 'CONTRACTOR'` default rides on top of the
 * tenant-scope and soft-delete predicates.
 * Use tenantStore.run({ organizationId }, callback) to set the tenant context
 * before executing queries.
 */
export function createTenantClient() {
  return withWorkerTypeDefault(withSoftDelete(withTenantScope(basePrisma)));
}

/**
 * Applies tenant scope + soft-delete + worker-type-default extensions to an
 * existing Prisma client (useful for `prisma.$transaction(async (tx) => ...)`
 * where `tx` is the client). Same outermost ordering as createTenantClient.
 */
export function createTenantClientFrom<T extends PrismaExtensible>(prisma: T) {
  return withWorkerTypeDefault(withSoftDelete(withTenantScope(prisma)));
}

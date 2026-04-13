import type { PrismaClient } from '@contractor-ops/db';
import type { TenantScopedDb } from '../lib/tenant-db.js';

export type { TenantScopedDb } from '../lib/tenant-db.js';

/**
 * Regional, tenant-scoped client (`ctx.db`). Use for all organization-bound queries/mutations
 * inside tenant procedures — it targets the correct region and enforces tenant scope.
 */
export type DbClient = TenantScopedDb;

/**
 * Primary Prisma singleton from `@contractor-ops/db` (EU routing table, cron, auth-adjacent
 * global tables). Do not use for tenant business data when `ctx.db` is available.
 */
export type PrimaryPrismaClient = PrismaClient;

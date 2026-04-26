import type { Prisma, PrismaClient } from '@contractor-ops/db';
import type { TenantScopedDb } from '../lib/tenant-db.js';

export type { TenantScopedDb } from '../lib/tenant-db.js';

/** Primary, interactive transaction, or tenant-scoped client — for calendar/deadline sync entrypoints. */
export type CalendarPrismaClient = PrismaClient | Prisma.TransactionClient | TenantScopedDb;

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

/** Primary Prisma singleton or tenant `ctx.db` — tax validation runs in both contexts. */
export type TaxValidationDb = PrimaryPrismaClient | DbClient;

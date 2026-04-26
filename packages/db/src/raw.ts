/**
 * PHASE-60-CROSS-ORG-AGGREGATE: non-tenant-scoped Prisma client.
 *
 * ONLY for cron cross-org reads (Phase 60 CLASS-07 economic-dependency scan —
 * the billing-share denominator needs to aggregate a contractor's invoices
 * across ALL organisations they bill, not just the current tenant).
 *
 * NEVER use this binding inside request handlers, tRPC procedures, or any
 * code path where a tenant AsyncLocalStorage frame is (or should be) active.
 *
 * The surrounding `withTenantScope` extension rejects queries outside a tenant
 * frame by design — this raw client deliberately bypasses that guard, so
 * every call-site must be auditable. Grep for `PHASE-60-CROSS-ORG-AGGREGATE`
 * to list every deliberate cross-org read.
 */

import { createMissingDatabaseUrlProxy, createPrismaClientForUrl } from './client.js';

function createRawPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return createMissingDatabaseUrlProxy();
  }
  return createPrismaClientForUrl(connectionString);
}

const globalForPrismaRaw = globalThis as unknown as {
  prismaRaw: ReturnType<typeof createRawPrismaClient> | undefined;
};

// PHASE-60-CROSS-ORG-AGGREGATE: singleton raw client, no tenant extension.
export const prismaRaw = globalForPrismaRaw.prismaRaw ?? createRawPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrismaRaw.prismaRaw = prismaRaw;
}

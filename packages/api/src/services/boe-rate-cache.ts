// packages/api/src/services/boe-rate-cache.ts
//
// In-process cache for Bank of England base rate history (global reference data).
// Invalidated on admin CRUD; poller may leave cache stale until TTL — see invalidateBoeRateCache.

import type { RateHistoryEntry } from './late-payment-interest.js';

/**
 * Structural shape required by loadBoeRateHistory — narrow enough to accept
 * both the raw `PrismaClient` and the tenant-scoped/soft-delete-extended
 * client (`TenantScopedDb`). Avoids per-callsite `as unknown as` casts.
 */
type BoeDb = {
  boEBaseRateHistory: {
    findMany(args: {
      orderBy: { effectiveFrom: 'asc' };
      select: { effectiveFrom: true; ratePercent: true };
    }): Promise<Array<{ effectiveFrom: Date; ratePercent: RateHistoryEntry['ratePercent'] }>>;
  };
};

let memoryCache: RateHistoryEntry[] | null = null;

/**
 * Returns all BoE base rate rows as entries suitable for `calculateLateInterest`.
 * Callers may narrow `db` to `Pick<PrismaClient, 'boEBaseRateHistory'>`.
 */
export async function loadBoeRateHistory(db: BoeDb): Promise<RateHistoryEntry[]> {
  if (memoryCache !== null) {
    return memoryCache;
  }
  const rows = await db.boEBaseRateHistory.findMany({
    orderBy: { effectiveFrom: 'asc' },
    select: { effectiveFrom: true, ratePercent: true },
  });
  memoryCache = rows.map(r => ({
    effectiveFrom: r.effectiveFrom,
    ratePercent: r.ratePercent,
  }));
  return memoryCache;
}

export function invalidateBoeRateCache(): void {
  memoryCache = null;
}

/** Resets the module cache in unit tests. */
export function __resetBoeRateCacheForTests(): void {
  memoryCache = null;
}

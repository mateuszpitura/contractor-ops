// packages/api/src/services/boe-rate-cache.ts
//
// In-process cache for Bank of England base rate history (global reference data).
// Invalidated on admin CRUD; poller may leave cache stale until TTL — see invalidateBoeRateCache.

import type { RateHistoryEntry } from './late-payment-interest';

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

/**
 * Live cache TTL. The BoE poller writes new rate rows straight to the DB and
 * does NOT call `invalidateBoeRateCache`, so without a TTL the API process would
 * serve an in-memory copy indefinitely after a poller update. 5 minutes bounds
 * that staleness — ample for a rate that only changes on (pre-announced) MPC
 * decisions and consistent with the repo's other reference-data cache windows.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

let memoryCache: RateHistoryEntry[] | null = null;
let memoryCacheLoadedAt = 0;

/**
 * Returns all BoE base rate rows as entries suitable for `calculateLateInterest`.
 * Callers may narrow `db` to `Pick<PrismaClient, 'boEBaseRateHistory'>`.
 *
 * The in-memory copy is reused only within `CACHE_TTL_MS` of its load; past the
 * TTL it is refreshed so a poller-written rate is picked up without an explicit
 * invalidation.
 */
export async function loadBoeRateHistory(db: BoeDb): Promise<RateHistoryEntry[]> {
  if (memoryCache !== null && Date.now() - memoryCacheLoadedAt < CACHE_TTL_MS) {
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
  memoryCacheLoadedAt = Date.now();
  return memoryCache;
}

export function invalidateBoeRateCache(): void {
  memoryCache = null;
  memoryCacheLoadedAt = 0;
}

/** Resets the module cache in unit tests. */
export function __resetBoeRateCacheForTests(): void {
  memoryCache = null;
  memoryCacheLoadedAt = 0;
}

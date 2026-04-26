// packages/api/src/services/boe-rate-cache.ts
//
// In-process cache for Bank of England base rate history (global reference data).
// Invalidated on admin CRUD; poller may leave cache stale until TTL — see invalidateBoeRateCache.

import type { PrismaClient } from '@contractor-ops/db';
import type { RateHistoryEntry } from './late-payment-interest.js';

type BoeDb = Pick<PrismaClient, 'boEBaseRateHistory'>;

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

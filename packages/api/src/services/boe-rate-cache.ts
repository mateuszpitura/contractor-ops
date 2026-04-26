/**
 * In-memory cache for `BoEBaseRateHistory` — a global reference table with
 * 20-50 rows that's read on every late-payment-interest calculation.
 *
 * Not distributed: each instance keeps its own copy. Admin mutations call
 * `invalidate()` to flush the local copy; other instances refresh on the
 * next read after the TTL window expires. That's acceptable because:
 *
 *   - the BoE rate changes once per quarter in practice,
 *   - stale reads for a few seconds produce financially identical results
 *     (same numeric rate applied to the same invoice),
 *   - forcing distributed invalidation would add a Redis round-trip on the
 *     hot path we're trying to speed up.
 *
 * On a multi-instance deploy, admins editing the rate will see their own
 * instance refresh immediately; remote instances pick it up within
 * `TTL_MS`. If stronger consistency is ever required, switch to Upstash
 * pub/sub with instance-local caching and a `SUBSCRIBE boe-rate:invalidate`
 * channel.
 */

import type { PrismaClient } from '@contractor-ops/db';

export interface BoeRateRow {
  effectiveFrom: Date;
  ratePercent: number | { toNumber(): number } | string;
}

type Loader = (db: Pick<PrismaClient, 'boEBaseRateHistory'>) => Promise<BoeRateRow[]>;

const defaultLoader: Loader = async db => {
  const rows = await db.boEBaseRateHistory.findMany({
    orderBy: { effectiveFrom: 'desc' },
    select: { effectiveFrom: true, ratePercent: true },
  });
  return rows as BoeRateRow[];
};

// §247 BGB (the source of truth for BoE base rate in the German late-payment
// interest regime) changes the rate twice a year — Jan 1 and Jul 1. The
// practical change frequency of the underlying data is therefore measured in
// months, not seconds. We cap at 1h so that admin mutations propagate to
// every replica within a guaranteed window, but any tighter TTL is wasted
// DB load. Admin writes invalidate the local copy synchronously (see
// `admin-boe-rate` router) — cross-replica propagation is the only thing
// the TTL controls.
const TTL_MS = 60 * 60 * 1_000;

let cached: { rows: BoeRateRow[]; expiresAtMs: number } | null = null;
let inflight: Promise<BoeRateRow[]> | null = null;

/**
 * Load BoE rate history. Coalesces concurrent loaders so N parallel
 * requests at cold start produce exactly one DB query.
 */
export async function loadBoeRateHistory(
  db: Pick<PrismaClient, 'boEBaseRateHistory'>,
  loader: Loader = defaultLoader,
): Promise<BoeRateRow[]> {
  const now = Date.now();
  if (cached && now < cached.expiresAtMs) {
    return cached.rows;
  }

  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const rows = await loader(db);
      cached = { rows, expiresAtMs: Date.now() + TTL_MS };
      return rows;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Flush the cache on this instance. Call after any write to the table. */
export function invalidateBoeRateCache(): void {
  cached = null;
}

/** Testing helper. */
export function __resetBoeRateCacheForTests(): void {
  cached = null;
  inflight = null;
}

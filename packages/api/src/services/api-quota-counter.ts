import { createLogger } from '@contractor-ops/logger';
import { getServerEnv } from '@contractor-ops/validators';
import { Redis } from '@upstash/redis';

const log = createLogger({ service: 'api-quota-counter' });

// ---------------------------------------------------------------------------
// Per-org monthly request counter for the public API tier quota.
// ---------------------------------------------------------------------------
//
// Calendar-month fixed window keyed by `api-quota:{orgId}:{YYYY-MM}` (UTC). The
// counter is incremented once per authenticated request; a TTL to month-end is
// set on the first increment so the window self-expires.
//
// Primary path: Upstash Redis INCR — shared across instances so a horizontally
// scaled deployment enforces one global monthly count per org.
//
// Fallback path: an in-memory per-instance counter when Upstash env is unset.
// This is best-effort and per-pod; PRODUCTION MUST set the Upstash env for a
// correct global quota (a prod boot without it is logged as an error).

let redis: Redis | null = null;
let warnedNoRedis = false;

function getRedis(): Redis | null {
  if (redis) return redis;
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = getServerEnv();
  if (!(url && token)) return null;
  redis = new Redis({ url, token });
  return redis;
}

function currentMonthKey(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** Seconds until the start of next UTC month (the fixed-window reset boundary). */
function secondsUntilMonthEnd(now: Date): number {
  const nextMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0);
  return Math.max(1, Math.ceil((nextMonthStart - now.getTime()) / 1000));
}

const memoryCounters = new Map<string, { count: number; resetAtMs: number }>();

/**
 * Increment and return the org's request count for the current calendar month.
 * Enterprise (unlimited) callers should short-circuit BEFORE calling this so no
 * counter is written for them.
 */
export async function incrementMonthlyRequestCount(organizationId: string): Promise<number> {
  const now = new Date();
  const key = `api-quota:${organizationId}:${currentMonthKey(now)}`;

  const client = getRedis();
  if (client) {
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, secondsUntilMonthEnd(now));
    }
    return count;
  }

  if (!warnedNoRedis && (process.env.NODE_ENV ?? 'development') === 'production') {
    warnedNoRedis = true;
    log.error(
      'UPSTASH_REDIS_REST_URL/TOKEN unset in production — monthly API quota is per-instance only',
    );
  }

  const nowMs = now.getTime();
  const resetAtMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0);
  let entry = memoryCounters.get(key);
  if (!entry || nowMs >= entry.resetAtMs) {
    entry = { count: 0, resetAtMs };
    memoryCounters.set(key, entry);
  }
  entry.count += 1;
  return entry.count;
}

/**
 * Read the org's current calendar-month request count WITHOUT incrementing it.
 * Used by the Developer page's usage display; returns 0 when no request has been
 * counted this month.
 */
export async function getMonthlyRequestCount(organizationId: string): Promise<number> {
  const now = new Date();
  const key = `api-quota:${organizationId}:${currentMonthKey(now)}`;

  const client = getRedis();
  if (client) {
    const value = await client.get<number>(key);
    return typeof value === 'number' ? value : Number(value ?? 0);
  }

  const entry = memoryCounters.get(key);
  if (!entry || now.getTime() >= entry.resetAtMs) return 0;
  return entry.count;
}

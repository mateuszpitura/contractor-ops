/**
 * Per-subscription dispatch rate limit (INTEG-SEC-03) — 100 events/min.
 *
 * A fixed-window minute counter keyed `whrl:{subscriptionId}:{YYYYMMDDHHmm}`
 * (mirrors the P99 monthly quota counter). The deliver drain calls this BEFORE
 * the POST; over-limit → the drain requeues the attempt with a short delay
 * (throttle, NOT drop). Fails OPEN on a counter-backend outage so a Redis blip
 * never silently swallows legitimate events.
 */

import { createLogger } from '@contractor-ops/logger';
import { getServerEnv } from '@contractor-ops/validators';
import { Redis } from '@upstash/redis';

const log = createLogger({ service: 'webhook-rate-limit' });

/** Max deliveries per subscription per minute. */
export const WEBHOOK_DISPATCH_RATE_LIMIT_PER_MIN = 100;

const WINDOW_TTL_SECONDS = 70;

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = getServerEnv();
  if (!(url && token)) return null;
  redis = new Redis({ url, token });
  return redis;
}

function minuteBucket(now: Date): string {
  return (
    `${now.getUTCFullYear()}` +
    `${String(now.getUTCMonth() + 1).padStart(2, '0')}` +
    `${String(now.getUTCDate()).padStart(2, '0')}` +
    `${String(now.getUTCHours()).padStart(2, '0')}` +
    `${String(now.getUTCMinutes()).padStart(2, '0')}`
  );
}

const memoryCounters = new Map<string, { count: number; resetAtMs: number }>();

async function defaultIncr(key: string): Promise<number> {
  const client = getRedis();
  if (client) {
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, WINDOW_TTL_SECONDS);
    return count;
  }
  const nowMs = Date.now();
  let entry = memoryCounters.get(key);
  if (!entry || nowMs >= entry.resetAtMs) {
    entry = { count: 0, resetAtMs: nowMs + WINDOW_TTL_SECONDS * 1000 };
    memoryCounters.set(key, entry);
  }
  entry.count += 1;
  return entry.count;
}

export interface DispatchRateLimitOptions {
  now?: Date;
  /** Injectable counter for tests. Defaults to the Upstash fixed-window counter. */
  incr?: (key: string) => Promise<number>;
}

/**
 * Returns true if this subscription is OVER its per-minute dispatch limit.
 * Fails OPEN (returns false) if the counter backend errors.
 */
export async function overDispatchRateLimit(
  subscriptionId: string,
  opts: DispatchRateLimitOptions = {},
): Promise<boolean> {
  const now = opts.now ?? new Date();
  const key = `whrl:${subscriptionId}:${minuteBucket(now)}`;
  const incr = opts.incr ?? defaultIncr;
  try {
    const count = await incr(key);
    return count > WEBHOOK_DISPATCH_RATE_LIMIT_PER_MIN;
  } catch (err) {
    log.warn({ err, subscriptionId }, 'dispatch rate-limit counter unavailable — failing open');
    return false;
  }
}

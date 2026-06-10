/**
 * Rate-limit primitives shared by every plugin/route that throttles a path.
 *
 * Backend selection:
 *
 *   - Upstash sliding-window (`@upstash/ratelimit`) when both env vars are
 *     set. Single-tenant deployments without Redis still get protection via
 *     the in-memory LRU fallback.
 *   - In-memory LRU fallback (Map of `{count, resetAt, lastSeenMs}`) keyed
 *     by `prefix:identifier`. Map is bounded at FALLBACK_MAX_ENTRIES; LRU
 *     evicts the 10 % oldest entries by `lastSeenMs` on overflow — FIFO
 *     would eject legitimate users while preserving slow attackers.
 *
 * Production policy is **fail-closed** — a `RateLimiterUnavailableError`
 * propagates to the plugin which translates it to `503 Retry-After: 5`.
 * Letting requests through during an Upstash outage hands attackers a free
 * DoS / credential-stuffing window against /api/auth, /api/portal, /api/trpc.
 *
 * Dev/test policy is **fail-open** to the in-memory counter so local boots
 * keep working when Redis isn't configured. The drift is reported via
 * Sentry breadcrumb on every miss and a captureMessage at most once per
 * `UPSTASH_ALERT_INTERVAL_MS` so Sentry quota survives an extended outage.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { Sentry } from './sentry.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  reset: number;
}

export class RateLimiterUnavailableError extends Error {
  constructor() {
    super('rate limiter backend unavailable');
    this.name = 'RateLimiterUnavailableError';
  }
}

interface FallbackEntry {
  count: number;
  resetAt: number;
  lastSeenMs: number;
}

const FALLBACK_WINDOW_MS = 60_000;
const FALLBACK_MAX_ENTRIES = 10_000;
const UPSTASH_ALERT_INTERVAL_MS = 60_000;
let lastUpstashAlertAt = 0;

export interface RateLimiter {
  /** Hit the limiter. Throws RateLimiterUnavailableError in prod on backend failure. */
  check(identifier: string): Promise<RateLimitResult>;
}

interface CreateLimiterOptions {
  /** Allowed requests per window. */
  max: number;
  /** Window string accepted by `Ratelimit.slidingWindow` (e.g. '1m', '15s'). */
  window: Parameters<typeof Ratelimit.slidingWindow>[1];
  /** Namespace used both in Upstash analytics and the in-memory key. */
  prefix: string;
  /** When 'production', Upstash failures throw RateLimiterUnavailableError. */
  failurePosture: 'production' | 'permissive';
  redisUrl?: string;
  redisToken?: string;
}

export function createRateLimiter(opts: CreateLimiterOptions): RateLimiter {
  const fallbackMap = new Map<string, FallbackEntry>();
  const upstash =
    opts.redisUrl && opts.redisToken
      ? new Ratelimit({
          redis: new Redis({ url: opts.redisUrl, token: opts.redisToken }),
          limiter: Ratelimit.slidingWindow(opts.max, opts.window),
          analytics: false,
          prefix: opts.prefix,
        })
      : null;

  function fallback(key: string): RateLimitResult {
    const now = Date.now();
    const namespaced = `${opts.prefix}:${key}`;
    const entry = fallbackMap.get(namespaced);

    if (!entry || now > entry.resetAt) {
      if (fallbackMap.size >= FALLBACK_MAX_ENTRIES) {
        const toEvict = Math.ceil(FALLBACK_MAX_ENTRIES * 0.1);
        for (let i = 0; i < toEvict; i++) evictOldestLru(fallbackMap);
      }
      fallbackMap.set(namespaced, {
        count: 1,
        resetAt: now + FALLBACK_WINDOW_MS,
        lastSeenMs: now,
      });
      return {
        allowed: true,
        remaining: opts.max - 1,
        limit: opts.max,
        reset: now + FALLBACK_WINDOW_MS,
      };
    }

    entry.count++;
    entry.lastSeenMs = now;
    return {
      allowed: entry.count <= opts.max,
      remaining: Math.max(0, opts.max - entry.count),
      limit: opts.max,
      reset: entry.resetAt,
    };
  }

  return {
    async check(identifier: string): Promise<RateLimitResult> {
      if (upstash) {
        try {
          const result = await upstash.limit(identifier);
          return {
            allowed: result.success,
            remaining: result.remaining,
            limit: result.limit,
            reset: result.reset,
          };
        } catch (err) {
          if (opts.failurePosture === 'production') {
            Sentry.captureException(err, {
              level: 'error',
              tags: { component: 'api-rate-limit', limiter: opts.prefix },
              extra: { reason: 'upstash unavailable; failing closed' },
            });
            throw new RateLimiterUnavailableError();
          }
          // dev/test: breadcrumb every miss (cheap), throttled captureMessage.
          Sentry.addBreadcrumb({
            category: 'rate-limit',
            level: 'warning',
            message: 'upstash rate limiter unavailable — falling back to in-memory',
            data: { limiter: opts.prefix, error: String(err) },
          });
          const now = Date.now();
          if (now - lastUpstashAlertAt > UPSTASH_ALERT_INTERVAL_MS) {
            lastUpstashAlertAt = now;
            Sentry.captureMessage('upstash rate limiter unavailable — falling back to in-memory', {
              level: 'warning',
              tags: { component: 'api-rate-limit', limiter: opts.prefix },
            });
          }
          return fallback(identifier);
        }
      }
      return fallback(identifier);
    },
  };
}

function evictOldestLru(map: Map<string, FallbackEntry>): void {
  let oldestKey: string | undefined;
  let oldestSeen = Number.POSITIVE_INFINITY;
  for (const [k, v] of map) {
    if (v.lastSeenMs < oldestSeen) {
      oldestSeen = v.lastSeenMs;
      oldestKey = k;
    }
  }
  if (oldestKey) map.delete(oldestKey);
}

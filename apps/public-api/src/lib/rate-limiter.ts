import { createLogger } from '@contractor-ops/logger';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { Context, MiddlewareHandler } from 'hono';

const log = createLogger({ service: 'public-api', component: 'rate-limiter' });

// ---------------------------------------------------------------------------
// Rate limiter middleware for public API
// ---------------------------------------------------------------------------
//
// Primary path: Upstash Redis sliding-window limiter — shared across all
// instances so a horizontally scaled deployment enforces a single global
// cap per API key rather than (N_instances × cap).
//
// Fallback path: in-memory sliding window when UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN are unset, or when Redis transiently errors.
// This is intentionally best-effort on a multi-instance deploy — production
// deployments MUST set the Upstash env for correct enforcement.

const KEY_PREFIXES = ['co_live_', 'co_test_'] as const;

const windowMs = 60_000; // 1 minute
const maxRequestsPerKey = 100;
const MAX_WINDOWS = 50_000; // Safety cap to prevent memory exhaustion

// --- Upstash limiter (singleton, created only when env is configured) ---
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasRedis = Boolean(upstashUrl && upstashToken);

const upstashLimiter: Ratelimit | null = hasRedis
  ? new Ratelimit({
      redis: new Redis({ url: upstashUrl as string, token: upstashToken as string }),
      limiter: Ratelimit.slidingWindow(maxRequestsPerKey, '1 m'),
      prefix: 'public-api:perKey',
      analytics: false,
    })
  : null;

// --- In-memory fallback ---
//
// Entries track `lastSeenMs`; eviction at `MAX_WINDOWS` is LRU (oldest
// `lastSeenMs` first). Previously the eviction batch was insertion-order
// FIFO, which during a sustained Redis outage evicted legitimate long-running
// clients before lower-rate attackers — the wrong incentive direction. LRU
// keeps the active workload in the map.
type RlWindow = { count: number; resetAt: number; lastSeenMs: number };
const windows = new Map<string, RlWindow>();

function evictOldestLruWindow(): void {
  let oldestKey: string | undefined;
  let oldestSeen = Number.POSITIVE_INFINITY;
  for (const [k, v] of windows) {
    if (v.lastSeenMs < oldestSeen) {
      oldestSeen = v.lastSeenMs;
      oldestKey = k;
    }
  }
  if (oldestKey) windows.delete(oldestKey);
}

function enforceWindowCap(now: number): void {
  if (windows.size < MAX_WINDOWS) return;
  // Safety cap: prune expired windows first; then LRU-evict if still
  // over the cap.
  for (const [k, w] of windows) {
    if (now >= w.resetAt) windows.delete(k);
  }
  if (windows.size >= MAX_WINDOWS) {
    const toEvict = Math.ceil(MAX_WINDOWS * 0.1);
    for (let i = 0; i < toEvict; i++) {
      evictOldestLruWindow();
    }
  }
}

/**
 * Extracts a rate-limit key from the Authorization header.
 * Uses the key prefix (first 8 chars after co_live_) to avoid
 * storing full keys in memory.
 */
function extractRateLimitKey(c: Context): string | null {
  const auth = c.req.header('authorization') ?? '';
  const prefix = KEY_PREFIXES.find(p => auth.startsWith(`Bearer ${p}`));
  if (!prefix) return null;

  const random = auth.slice(`Bearer ${prefix}`.length);
  return `rl:${random.slice(0, 12)}`;
}

function fallbackLimit(key: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let window = windows.get(key);

  if (!window || now >= window.resetAt) {
    enforceWindowCap(now);
    window = { count: 0, resetAt: now + windowMs, lastSeenMs: now };
    windows.set(key, window);
  }

  window.count++;
  window.lastSeenMs = now;

  return {
    allowed: window.count <= maxRequestsPerKey,
    remaining: Math.max(0, maxRequestsPerKey - window.count),
    resetAt: window.resetAt,
  };
}

/**
 * Rate limiting middleware.
 * Returns 429 with Retry-After header when limit is exceeded.
 *
 * Typed as Hono's `MiddlewareHandler` so callers (and tests) get the proper
 * `Promise<Response | void>` return shape instead of an inferred mismatch.
 */
export const rateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  const key = extractRateLimitKey(c);

  // No key = will fail at auth anyway, skip rate limiting
  if (!key) {
    await next();
    return;
  }

  let allowed: boolean;
  let remaining: number;
  let resetAtMs: number;

  if (upstashLimiter) {
    try {
      const result = await upstashLimiter.limit(key);
      allowed = result.success;
      remaining = result.remaining;
      resetAtMs = result.reset;
    } catch (err) {
      // Fail-CLOSED in production. The in-memory fallback is per-instance and
      // ineffective on a multi-pod deploy, so allowing requests through during
      // a Redis outage gives an attacker a free DoS window against authenticated
      // API keys. Surface a 503 + Retry-After so clients back off and on-call
      // sees the spike.
      const env = process.env.NODE_ENV ?? 'development';
      if (env === 'production') {
        log.error({ err }, 'upstash rate limiter unavailable — failing closed (503)');
        const retryAfterSec = 5;
        c.header('Retry-After', String(retryAfterSec));
        return c.json(
          {
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Rate limit backend unavailable. Please retry shortly.',
              status: 503,
            },
          },
          503,
        );
      }
      // dev/test: best-effort in-memory so local runs aren't broken.
      log.warn(
        { err, env },
        'upstash rate limiter unavailable — falling back to in-memory (non-prod only)',
      );
      const fb = fallbackLimit(key);
      allowed = fb.allowed;
      remaining = fb.remaining;
      resetAtMs = fb.resetAt;
    }
  } else {
    const fb = fallbackLimit(key);
    allowed = fb.allowed;
    remaining = fb.remaining;
    resetAtMs = fb.resetAt;
  }

  // Set rate limit headers
  c.header('X-RateLimit-Limit', String(maxRequestsPerKey));
  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-Reset', String(Math.ceil(resetAtMs / 1000)));
  c.header('X-RateLimit-Store', upstashLimiter ? 'redis' : 'memory');

  if (!allowed) {
    const retryAfter = Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000));
    c.header('Retry-After', String(retryAfter));
    return c.json(
      {
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded. Please retry later.',
          status: 429,
        },
      },
      429,
    );
  }

  await next();
  return;
};

// Periodic cleanup of expired windows (every 1 minute — matches window duration)
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of windows) {
    if (now >= window.resetAt) {
      windows.delete(key);
    }
  }
}, 60_000).unref();

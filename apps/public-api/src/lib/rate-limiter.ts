import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { Context, MiddlewareHandler } from 'hono';

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

const KEY_PREFIX = 'co_live_';

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
const windows = new Map<string, { count: number; resetAt: number }>();

/**
 * Extracts a rate-limit key from the Authorization header.
 * Uses the key prefix (first 8 chars after co_live_) to avoid
 * storing full keys in memory.
 */
function extractRateLimitKey(c: Context): string | null {
  const auth = c.req.header('authorization') ?? '';
  if (!auth.startsWith(`Bearer ${KEY_PREFIX}`)) return null;

  const random = auth.slice(`Bearer ${KEY_PREFIX}`.length);
  return `rl:${random.slice(0, 12)}`;
}

function fallbackLimit(key: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let window = windows.get(key);

  if (!window || now >= window.resetAt) {
    // Safety cap: evict expired windows if map grows too large
    if (windows.size >= MAX_WINDOWS) {
      for (const [k, w] of windows) {
        if (now >= w.resetAt) windows.delete(k);
      }
      if (windows.size >= MAX_WINDOWS) {
        const toEvict = Math.ceil(MAX_WINDOWS * 0.1);
        const keysToEvict = Array.from(windows.keys()).slice(0, toEvict);
        for (const k of keysToEvict) {
          windows.delete(k);
        }
      }
    }
    window = { count: 0, resetAt: now + windowMs };
    windows.set(key, window);
  }

  window.count++;

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
    } catch {
      // Redis transient error: fall back to in-memory so we still catch a
      // runaway loop on the same instance. Logged via the error handler.
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

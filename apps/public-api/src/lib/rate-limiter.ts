import type { Context, Next } from 'hono';

// ---------------------------------------------------------------------------
// Rate limiter middleware for public API
// ---------------------------------------------------------------------------

const KEY_PREFIX = 'co_live_';

// In-memory sliding window (simple but effective for single-instance deploys).
// For multi-instance, replace with Upstash Ratelimit.
const windowMs = 60_000; // 1 minute
const maxRequestsPerKey = 100;
const MAX_WINDOWS = 50_000; // Safety cap to prevent memory exhaustion

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

/**
 * Rate limiting middleware.
 * Returns 429 with Retry-After header when limit is exceeded.
 */
export async function rateLimitMiddleware(c: Context, next: Next) {
  const key = extractRateLimitKey(c);

  // No key = will fail at auth anyway, skip rate limiting
  if (!key) {
    await next();
    return;
  }

  const now = Date.now();
  let window = windows.get(key);

  if (!window || now >= window.resetAt) {
    // Safety cap: evict expired windows if map grows too large
    if (windows.size >= MAX_WINDOWS) {
      for (const [k, w] of windows) {
        if (now >= w.resetAt) windows.delete(k);
      }
      // If still over limit after eviction, drop oldest 10% (array copy for safe iteration)
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

  // Set rate limit headers
  const remaining = Math.max(0, maxRequestsPerKey - window.count);
  c.header('X-RateLimit-Limit', String(maxRequestsPerKey));
  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-Reset', String(Math.ceil(window.resetAt / 1000)));

  if (window.count > maxRequestsPerKey) {
    const retryAfter = Math.ceil((window.resetAt - now) / 1000);
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
}

// Periodic cleanup of expired windows (every 1 minute — matches window duration)
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of windows) {
    if (now >= window.resetAt) {
      windows.delete(key);
    }
  }
}, 60_000).unref();

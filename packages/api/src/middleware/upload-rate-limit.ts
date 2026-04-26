// ---------------------------------------------------------------------------
// Upload rate-limit middleware
// ---------------------------------------------------------------------------
//
// Caps file upload mutations (`requestUpload`, `uploadNewVersion`) at 10 per
// minute per user. Mirrors the classification-rate-limit pattern:
//
//   - Upstash Redis (sliding window) when UPSTASH_REDIS_REST_URL +
//     UPSTASH_REDIS_REST_TOKEN are set — correct for horizontally-scaled
//     deployments.
//   - In-memory sliding window fallback for dev / single-instance / tests.

import { TRPCError } from '@trpc/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { t } from '../init.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const WINDOW_MS = 60_000;
const MAX_UPLOADS = 10;
const FALLBACK_MAX_MAP_ENTRIES = 10_000;

// ---------------------------------------------------------------------------
// Upstash limiter (only when env configured)
// ---------------------------------------------------------------------------

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasRedis = Boolean(upstashUrl && upstashToken);

const upstashLimiter: Ratelimit | null = hasRedis
  ? new Ratelimit({
      redis: new Redis({ url: upstashUrl as string, token: upstashToken as string }),
      limiter: Ratelimit.slidingWindow(MAX_UPLOADS, '1 m'),
      prefix: 'upload:perUser',
      analytics: false,
    })
  : null;

// ---------------------------------------------------------------------------
// In-memory fallback (dev / single-instance / tests)
// ---------------------------------------------------------------------------

// Cleanup happens on-access (lazy) rather than via setInterval — stale
// entries are pruned inside `fallbackCheck` below. The prior timer was
// decorative in serverless/edge runtimes where the module is recycled
// frequently.
const fallbackMap = new Map<string, { timestamps: number[] }>();

function fallbackCheck(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = fallbackMap.get(userId) ?? { timestamps: [] };

  entry.timestamps = entry.timestamps.filter(ts => now - ts < WINDOW_MS);

  if (entry.timestamps.length >= MAX_UPLOADS) {
    return { allowed: false, remaining: 0 };
  }

  if (!fallbackMap.has(userId) && fallbackMap.size >= FALLBACK_MAX_MAP_ENTRIES) {
    const oldest = fallbackMap.keys().next().value;
    if (oldest) fallbackMap.delete(oldest);
  }

  entry.timestamps.push(now);
  fallbackMap.set(userId, entry);
  return { allowed: true, remaining: MAX_UPLOADS - entry.timestamps.length };
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * tRPC middleware that rate-limits file upload requests per user.
 * Apply to `requestUpload` and `uploadNewVersion` mutations.
 */
export const uploadRateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  const userId = (ctx as { user?: { id: string } }).user?.id;
  if (!userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  let allowed: boolean;
  let remaining: number;

  if (upstashLimiter) {
    try {
      const result = await upstashLimiter.limit(userId);
      allowed = result.success;
      remaining = result.remaining;
    } catch {
      // Redis transient error: fall back to in-memory count so we still
      // detect a runaway upload loop on the same instance.
      const fb = fallbackCheck(userId);
      allowed = fb.allowed;
      remaining = fb.remaining;
    }
  } else {
    const fb = fallbackCheck(userId);
    allowed = fb.allowed;
    remaining = fb.remaining;
  }

  if (!allowed) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'errors.upload.rateLimitExceeded',
    });
  }

  return next({
    ctx: {
      ...ctx,
      uploadRateLimit: { remaining },
    },
  });
});

/**
 * Testing helper — clears the in-memory fallback counter between tests so a
 * rate-limit burst in one test does not leak into the next.
 */
export function __resetUploadRateLimitForTests(): void {
  fallbackMap.clear();
}

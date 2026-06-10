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

import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { UPLOAD_RATE_LIMIT_EXCEEDED, UPLOAD_RATE_LIMITER_UNAVAILABLE } from '../errors';
import { t } from '../init';

const log = createLogger({ service: 'api', component: 'upload-rate-limit' });

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
//
// Entries track `lastSeenMs` and eviction is LRU (oldest `lastSeenMs`
// first), not insertion-order FIFO. The previous FIFO behaviour evicted
// legitimate users who happened to hit the system first while preserving
// low-rate attackers who arrived later, which is the wrong incentive
// direction during a Redis outage.
type FallbackEntry = { timestamps: number[]; lastSeenMs: number };
const fallbackMap = new Map<string, FallbackEntry>();

function evictOldestLruEntry(): void {
  let oldestKey: string | undefined;
  let oldestSeen = Number.POSITIVE_INFINITY;
  for (const [k, v] of fallbackMap) {
    if (v.lastSeenMs < oldestSeen) {
      oldestSeen = v.lastSeenMs;
      oldestKey = k;
    }
  }
  if (oldestKey) fallbackMap.delete(oldestKey);
}

function fallbackCheck(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry: FallbackEntry = fallbackMap.get(userId) ?? { timestamps: [], lastSeenMs: now };

  entry.timestamps = entry.timestamps.filter(ts => now - ts < WINDOW_MS);
  entry.lastSeenMs = now;

  if (entry.timestamps.length >= MAX_UPLOADS) {
    fallbackMap.set(userId, entry);
    return { allowed: false, remaining: 0 };
  }

  if (!fallbackMap.has(userId) && fallbackMap.size >= FALLBACK_MAX_MAP_ENTRIES) {
    evictOldestLruEntry();
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
    } catch (err) {
      // In production, fail-CLOSED if Upstash is unreachable. The in-memory
      // fallback only counts uploads on a single web pod; with the fleet at
      // 2-8 instances this is effectively no rate limit and lets a single
      // user OOM the upload pipeline during a Redis outage. dev/test still
      // falls back so local runs aren't blocked.
      const env = process.env.NODE_ENV ?? 'development';
      if (env === 'production') {
        log.error({ err, userId }, 'upstash rate limiter unavailable — failing closed for upload');
        // 503 SERVICE_UNAVAILABLE — clients should retry with backoff.
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message: UPLOAD_RATE_LIMITER_UNAVAILABLE,
        });
      }
      log.warn(
        { err, env, userId },
        'upstash rate limiter unavailable — falling back to in-memory (non-prod only)',
      );
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
      message: UPLOAD_RATE_LIMIT_EXCEEDED,
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

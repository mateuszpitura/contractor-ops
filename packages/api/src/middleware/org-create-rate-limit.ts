// ---------------------------------------------------------------------------
// Organization-create rate-limit middleware (NEW-SEC-05)
// ---------------------------------------------------------------------------
//
// Caps `organization.create` mutations at 5 per 24h per authenticated user.
// Closes the abuse vector flagged by the R1 security audit (NEW-SEC-05):
// a single signed-in user could otherwise spam org creation and exhaust the
// slug namespace, fill audit logs, and trigger post-create hooks (KT seed
// templates, billing customer rows) without any per-user cap. The global
// /api/trpc 60/min bucket does not stop a 60-orgs-per-minute burst.
//
// Strategy mirrors `upload-rate-limit.ts` and `classification-rate-limit.ts`:
//
//   - Upstash Redis sliding window when UPSTASH_REDIS_REST_URL +
//     UPSTASH_REDIS_REST_TOKEN are set — correct for horizontally-scaled
//     deployments where a single user can hit any web pod.
//   - In-memory sliding window fallback for dev / single-instance / tests.
//   - Production fail-CLOSED (503) when Upstash is unreachable, matching the
//     existing rate-limit middlewares — org creation is rare and a brief
//     outage of new-org provisioning is preferable to lifting the cap.
//
// Key shape: `org-create:${userId}`. Per-user, per-day. The `user` ctx is
// guaranteed by the upstream `authMiddleware` chain via `authedProcedure`.

import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import {
  ORGANIZATION_CREATE_RATE_LIMIT_EXCEEDED,
  ORGANIZATION_RATE_LIMITER_UNAVAILABLE,
} from '../errors';
import { t } from '../init';

const log = createLogger({ service: 'api', component: 'org-create-rate-limit' });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_ORG_CREATES = 5;
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
      // Upstash duration grammar: "24 h" → 24 hours sliding window.
      limiter: Ratelimit.slidingWindow(MAX_ORG_CREATES, '24 h'),
      prefix: 'org-create:perUser',
      analytics: false,
    })
  : null;

// ---------------------------------------------------------------------------
// In-memory fallback (dev / single-instance / tests)
// ---------------------------------------------------------------------------
//
// LRU-evicted on size cap. Stale entries are pruned on access — no setInterval
// (24h timestamps are too sparse for periodic cleanup to matter, and timers
// don't unref reliably across edge runtime recycles).

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

  if (entry.timestamps.length >= MAX_ORG_CREATES) {
    fallbackMap.set(userId, entry);
    return { allowed: false, remaining: 0 };
  }

  if (!fallbackMap.has(userId) && fallbackMap.size >= FALLBACK_MAX_MAP_ENTRIES) {
    evictOldestLruEntry();
  }

  entry.timestamps.push(now);
  fallbackMap.set(userId, entry);
  return { allowed: true, remaining: MAX_ORG_CREATES - entry.timestamps.length };
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * tRPC middleware that rate-limits organization-create requests per
 * authenticated user. Apply downstream of `authedProcedure` so `ctx.user.id`
 * is guaranteed populated.
 */
export const orgCreateRateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  const userId = (ctx as { user?: { id: string } }).user?.id;
  if (!userId) {
    // Defensive — `authedProcedure` should already have rejected, but a future
    // refactor that drops the auth chain shouldn't silently disable the cap.
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  let allowed: boolean;
  let remaining: number;

  if (upstashLimiter) {
    try {
      const result = await upstashLimiter.limit(`org-create:${userId}`);
      allowed = result.success;
      remaining = result.remaining;
    } catch (err) {
      // Production fails closed — matches `upload-rate-limit.ts` precedent.
      // Org creation is rare and bypassing the cap during a Redis outage
      // would re-open the abuse vector this middleware exists to close.
      const env = process.env.NODE_ENV ?? 'development';
      if (env === 'production') {
        log.error(
          { err, userId },
          'upstash rate limiter unavailable — failing closed for organization.create',
        );
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message: ORGANIZATION_RATE_LIMITER_UNAVAILABLE,
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
    log.warn({ userId }, 'organization.create rate limit exceeded');
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: ORGANIZATION_CREATE_RATE_LIMIT_EXCEEDED,
    });
  }

  return next({
    ctx: {
      ...ctx,
      orgCreateRateLimit: { remaining },
    },
  });
});

/**
 * Testing helper — clears the in-memory fallback counter between tests so a
 * rate-limit burst in one test does not leak into the next.
 */
export function __resetOrgCreateRateLimitForTests(): void {
  fallbackMap.clear();
}

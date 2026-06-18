// ---------------------------------------------------------------------------
// Report / dashboard read rate-limit middleware
// ---------------------------------------------------------------------------
//
// Caps the most expensive read procedures — `report.*` (spendBy*,
// complianceGaps*, exports) and `dashboard.*` (KPIs/trends/deadlines) — at 30
// per minute per organization. These procedures run multi-table aggregates,
// raw GROUP BY scans, and (for the compliance-gap reports) in-JS computation
// over fetched rows; without a per-procedure budget a single tenant can pin
// writer CPU by hammering them. The global /api/trpc bucket is per-IP and does
// not bound per-org aggregate cost.
//
// Strategy mirrors `org-create-rate-limit.ts`, `upload-rate-limit.ts`, and
// `classification-rate-limit.ts`:
//
//   - Upstash Redis sliding window when UPSTASH_REDIS_REST_URL +
//     UPSTASH_REDIS_REST_TOKEN are set — correct for horizontally-scaled
//     deployments where one org can hit any web pod.
//   - In-memory sliding window fallback for dev / single-instance / tests.
//   - Production fail-CLOSED (503) when Upstash is unreachable: the in-memory
//     fallback is per-pod and cannot detect the same org hitting another
//     instance, so on a multi-pod deploy a Redis outage means no real cap.
//     Reports/dashboards tolerate a brief 503 + client backoff better than an
//     uncapped aggregate flood.
//
// Key shape: `report:${organizationId}`. Per-org. `ctx.organizationId` is
// guaranteed by the upstream `tenantProcedure` chain.

import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { REPORT_RATE_LIMIT_EXCEEDED, REPORT_RATE_LIMITER_UNAVAILABLE } from '../errors';
import { t } from '../init';

const log = createLogger({ service: 'api', component: 'report-rate-limit' });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Max report/dashboard read calls per minute per organization. Production
 * default is 30. Tests override via `__resetReportRateLimitForTests` to keep
 * burst loops short without weakening the production guarantee.
 */
const DEFAULT_MAX_CALLS_PER_MINUTE = 30;
let MaxCallsPerMinute = DEFAULT_MAX_CALLS_PER_MINUTE;
const WINDOW_MS = 60_000;
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
      limiter: Ratelimit.slidingWindow(MaxCallsPerMinute, '1 m'),
      prefix: 'report:perOrg',
      analytics: false,
    })
  : null;

// ---------------------------------------------------------------------------
// In-memory fallback (dev / single-instance / tests)
// ---------------------------------------------------------------------------
//
// LRU-evicted on size cap (oldest `lastSeenMs` first). Stale entries are pruned
// on access inside `fallbackCheck` — no setInterval, matching the
// upload/org-create precedents where the timer was decorative under edge
// runtime recycling.

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

function fallbackCheck(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry: FallbackEntry = fallbackMap.get(key) ?? { timestamps: [], lastSeenMs: now };

  entry.timestamps = entry.timestamps.filter(ts => now - ts < WINDOW_MS);
  entry.lastSeenMs = now;

  if (entry.timestamps.length >= MaxCallsPerMinute) {
    fallbackMap.set(key, entry);
    return { allowed: false, remaining: 0 };
  }

  if (!fallbackMap.has(key) && fallbackMap.size >= FALLBACK_MAX_MAP_ENTRIES) {
    evictOldestLruEntry();
  }

  entry.timestamps.push(now);
  fallbackMap.set(key, entry);
  return { allowed: true, remaining: MaxCallsPerMinute - entry.timestamps.length };
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * tRPC middleware that rate-limits expensive report/dashboard reads per
 * organization. Apply downstream of `tenantProcedure` so `ctx.organizationId`
 * is guaranteed populated.
 */
export const reportRateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  const organizationId = (ctx as { organizationId?: string }).organizationId;
  if (!organizationId) {
    // Defensive — `tenantProcedure` should already have rejected, but a future
    // refactor that drops the tenant chain shouldn't silently disable the cap.
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const key = `report:${organizationId}`;

  let allowed: boolean;
  let remaining: number;

  if (upstashLimiter) {
    try {
      const result = await upstashLimiter.limit(key);
      allowed = result.success;
      remaining = result.remaining;
    } catch (err) {
      const env = process.env.NODE_ENV ?? 'development';
      if (env === 'production') {
        log.error(
          { err, organizationId },
          'upstash rate limiter unavailable — failing closed for report/dashboard read',
        );
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message: REPORT_RATE_LIMITER_UNAVAILABLE,
        });
      }
      log.warn(
        { err, env, organizationId },
        'upstash rate limiter unavailable — falling back to in-memory (non-prod only)',
      );
      const fb = fallbackCheck(key);
      allowed = fb.allowed;
      remaining = fb.remaining;
    }
  } else {
    const fb = fallbackCheck(key);
    allowed = fb.allowed;
    remaining = fb.remaining;
  }

  if (!allowed) {
    log.warn({ organizationId }, 'report/dashboard read rate limit exceeded');
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: REPORT_RATE_LIMIT_EXCEEDED,
    });
  }

  return next({
    ctx: {
      ...ctx,
      reportRateLimit: { remaining },
    },
  });
});

/**
 * Testing helper — clears the in-memory fallback counter between tests so a
 * rate-limit burst in one test does not leak into the next. Optionally lowers
 * the per-minute max so burst loops stay short.
 */
export function __resetReportRateLimitForTests(max?: number): void {
  fallbackMap.clear();
  MaxCallsPerMinute = typeof max === 'number' && max > 0 ? max : DEFAULT_MAX_CALLS_PER_MINUTE;
}

/**
 * Exposed for test assertions so a fixture can verify the production default
 * has not drifted from the 30/min limit.
 */
export function __getReportRateLimitMaxForTests(): number {
  return MaxCallsPerMinute;
}

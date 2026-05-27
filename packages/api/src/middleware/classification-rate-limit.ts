// ---------------------------------------------------------------------------
// Classification autosave rate-limit middleware (Phase 58, Plan 03)
// ---------------------------------------------------------------------------
//
// Caps `classification.saveAnswer` at 120 calls per minute per assessmentId
// per organization — mitigates the autosave DoS loop documented in
// RESEARCH.md §Pitfall 10 and threat T-58-13 in the Plan 03 STRIDE register.
//
// Uses Upstash Redis (sliding window) when UPSTASH_REDIS_REST_URL +
// UPSTASH_REDIS_REST_TOKEN are set; otherwise falls back to an in-memory
// sliding window (dev / single-instance). Mirrors the pattern used by
// the Fastify rate-limit plugin (apps/api/src/plugins/rate-limit.ts) so
// deployment behaviour stays consistent.
//
// The limit key is `${organizationId}:${assessmentId}` — sharing an
// assessment across two orgs is not possible (tenantProcedure scopes), so
// this is effectively per-assessment, but prefixing with orgId keeps the key
// space balanced across tenants.

import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import {
  CLASSIFICATION_ASSESSMENT_ID_REQUIRED,
  CLASSIFICATION_AUTOSAVE_RATE_LIMIT_EXCEEDED,
  CLASSIFICATION_RATE_LIMITER_UNAVAILABLE,
} from '../errors';
import { t } from '../init';

const log = createLogger({ service: 'api', component: 'classification-rate-limit' });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Max saveAnswer calls per minute per assessment. The production default is
 * 120 (Pitfall 10). Tests can override via the __setClassificationRateLimitForTests
 * helper below to avoid long-running runtimes without weakening the
 * production guarantee.
 */
const DEFAULT_MAX_CALLS_PER_MINUTE = 120;
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
      prefix: 'classification:saveAnswer',
      analytics: false,
    })
  : null;

// ---------------------------------------------------------------------------
// In-memory fallback (dev / single-instance)
// ---------------------------------------------------------------------------
//
// F-SCALE-15 — entries track `lastSeenMs`; eviction at the size cap is LRU
// (oldest `lastSeenMs` first), not insertion-order FIFO. During a sustained
// Redis outage on a 5 000-contractor org with 100 active users, the FIFO
// approach evicted the first-arriving legitimate users while preserving
// later-arriving low-rate attackers — exactly the wrong incentive. LRU
// keeps the active workload in the map and pushes truly-stale keys out.

type FallbackEntry = { timestamps: number[]; lastSeenMs: number };
const fallbackMap = new Map<string, FallbackEntry>();

if (typeof globalThis !== 'undefined') {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of fallbackMap) {
      entry.timestamps = entry.timestamps.filter(ts => now - ts < WINDOW_MS);
      if (entry.timestamps.length === 0) fallbackMap.delete(key);
    }
  };
  setInterval(cleanup, 5 * 60_000).unref?.();
}

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
 * Applies Upstash/in-memory sliding-window rate limit to the upstream
 * classification.saveAnswer procedure. The input MUST contain an
 * `assessmentId` string — otherwise BAD_REQUEST is thrown.
 */
export const classificationSaveAnswerRateLimit = t.middleware(async ({ ctx, input, next }) => {
  const assessmentId =
    typeof input === 'object' && input !== null && 'assessmentId' in input
      ? String((input as { assessmentId: unknown }).assessmentId ?? '')
      : '';

  if (!assessmentId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: CLASSIFICATION_ASSESSMENT_ID_REQUIRED,
    });
  }

  const organizationId =
    typeof ctx === 'object' && ctx !== null && 'organizationId' in ctx
      ? String((ctx as { organizationId: unknown }).organizationId ?? '')
      : '';

  const key = `${organizationId}:${assessmentId}`;

  let allowed = true;
  if (upstashLimiter) {
    try {
      const result = await upstashLimiter.limit(key);
      allowed = result.success;
    } catch (err) {
      // F-SCALE-03: in production, fail-CLOSED if Upstash is unreachable.
      // The autosave loop is the cheapest possible DoS — a misbehaving
      // client can hammer saveAnswer at hundreds of req/s. The in-memory
      // fallback is per-pod and cannot detect the same assessment hitting
      // a different instance, so a Redis outage means no real cap on a
      // multi-pod deploy. dev/test still falls back so local runs work.
      const env = process.env.NODE_ENV ?? 'development';
      if (env === 'production') {
        log.error(
          { err, organizationId, assessmentId },
          'upstash rate limiter unavailable — failing closed for classification.saveAnswer',
        );
        // 503 SERVICE_UNAVAILABLE — autosave clients should back off and
        // retry. The autosave UX already tolerates transient failures.
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message: CLASSIFICATION_RATE_LIMITER_UNAVAILABLE,
        });
      }
      log.warn(
        { err, env, organizationId, assessmentId },
        'upstash rate limiter unavailable — falling back to in-memory (non-prod only)',
      );
      allowed = fallbackCheck(key).allowed;
    }
  } else {
    allowed = fallbackCheck(key).allowed;
  }

  if (!allowed) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: CLASSIFICATION_AUTOSAVE_RATE_LIMIT_EXCEEDED,
    });
  }

  return next({ ctx });
});

/**
 * Testing helper — clears the in-memory fallback counter between tests so a
 * saveAnswer-flood case study does not leak into the next test case.
 * Not exported from the router; test files import it directly.
 */
export function __resetClassificationRateLimitForTests(max?: number): void {
  fallbackMap.clear();
  MaxCallsPerMinute = typeof max === 'number' && max > 0 ? max : DEFAULT_MAX_CALLS_PER_MINUTE;
}

/**
 * Exposed for test assertions so a fixture can verify the production default
 * has not drifted from the 120/min documented in Pitfall 10.
 */
export function __getClassificationRateLimitMaxForTests(): number {
  return MaxCallsPerMinute;
}

// ---------------------------------------------------------------------------
// Portal per-subject rate-limit middleware
// ---------------------------------------------------------------------------
//
// Caps expensive portal-reachable procedures at 10 per minute per portal
// subject (contractor or employee). Guards two side-effect-heavy portal
// endpoints:
//
//   - `ocr.portalTrigger`      — drains org OCR credits + enqueues a QStash job.
//   - `esign.getPortalSigningUrl` — mints a provider (DocuSign / Autenti) URL.
//
// The global per-IP `/api/trpc/portal` bucket bounds an IP but not an
// authenticated subject looping a mutation; this caps per subject so one
// contractor cannot exhaust credits or hammer the e-sign provider.
//
// Strategy mirrors `upload-rate-limit.ts` (10/min/user):
//
//   - Upstash Redis sliding window when UPSTASH_REDIS_REST_URL +
//     UPSTASH_REDIS_REST_TOKEN are set — correct across a multi-pod fleet.
//   - In-memory sliding window fallback for dev / single-instance / tests.
//   - Production fail-CLOSED (503) when Upstash is unreachable.
//
// Key shape: `portal:${subjectId}`, where subjectId is the contractor or worker
// id from the validated portal session (set by `portal-auth` middleware).

import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { PORTAL_RATE_LIMIT_EXCEEDED, PORTAL_RATE_LIMITER_UNAVAILABLE } from '../errors';
import { t } from '../init';
import { runtimeEnv, upstashToken, upstashUrl } from './raw-env';

const log = createLogger({ service: 'api', component: 'portal-rate-limit' });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const FALLBACK_MAX_MAP_ENTRIES = 10_000;

// ---------------------------------------------------------------------------
// Upstash limiter (only when env configured)
// ---------------------------------------------------------------------------

const hasRedis = Boolean(upstashUrl && upstashToken);

const upstashLimiter: Ratelimit | null = hasRedis
  ? new Ratelimit({
      redis: new Redis({ url: upstashUrl as string, token: upstashToken as string }),
      limiter: Ratelimit.slidingWindow(MAX_REQUESTS, '1 m'),
      prefix: 'portal:perSubject',
      analytics: false,
    })
  : null;

// ---------------------------------------------------------------------------
// In-memory fallback (dev / single-instance / tests)
// ---------------------------------------------------------------------------

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

  if (entry.timestamps.length >= MAX_REQUESTS) {
    fallbackMap.set(key, entry);
    return { allowed: false, remaining: 0 };
  }

  if (!fallbackMap.has(key) && fallbackMap.size >= FALLBACK_MAX_MAP_ENTRIES) {
    evictOldestLruEntry();
  }

  entry.timestamps.push(now);
  fallbackMap.set(key, entry);
  return { allowed: true, remaining: MAX_REQUESTS - entry.timestamps.length };
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * tRPC middleware that rate-limits a portal procedure per subject. Apply
 * downstream of a portal procedure (`portalProcedure` / `portalEmployeeProcedure`)
 * so `ctx.contractorId` or `ctx.workerId` is populated.
 */
export const portalSubjectRateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  const c = ctx as { contractorId?: string | null; workerId?: string | null };
  const subjectId = c.contractorId ?? c.workerId;
  if (!subjectId) {
    // Defensive — the upstream portal auth chain should already have rejected,
    // but a future refactor that drops it shouldn't silently disable the cap.
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const key = `portal:${subjectId}`;

  let allowed: boolean;
  let remaining: number;

  if (upstashLimiter) {
    try {
      const result = await upstashLimiter.limit(key);
      allowed = result.success;
      remaining = result.remaining;
    } catch (err) {
      const env = runtimeEnv();
      if (env === 'production') {
        log.error(
          { err, subjectId },
          'upstash rate limiter unavailable — failing closed for portal',
        );
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message: PORTAL_RATE_LIMITER_UNAVAILABLE,
        });
      }
      log.warn(
        { err, env, subjectId },
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
    log.warn({ subjectId }, 'portal per-subject rate limit exceeded');
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: PORTAL_RATE_LIMIT_EXCEEDED,
    });
  }

  return next({
    ctx: {
      ...ctx,
      portalRateLimit: { remaining },
    },
  });
});

/**
 * Testing helper — clears the in-memory fallback counter between tests so a
 * rate-limit burst in one test does not leak into the next.
 */
export function __resetPortalRateLimitForTests(): void {
  fallbackMap.clear();
}

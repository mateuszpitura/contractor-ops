// ---------------------------------------------------------------------------
// Portal magic-link request rate-limit (per email)
// ---------------------------------------------------------------------------
//
// Caps `portal.requestMagicLink` at 5 requests per 15 minutes per email
// address. Without a per-email cap an attacker can bomb a victim's inbox with
// login emails: the global per-IP `/api/trpc/portal` bucket bounds one IP but
// does not bound how many distinct (or rotating) IPs target a single address.
//
// The email is hashed (SHA-256) before it becomes a limiter key or log field,
// so the counter store and logs never hold raw PII.
//
// Strategy mirrors `org-create-rate-limit.ts` / `upload-rate-limit.ts`:
//
//   - Upstash Redis sliding window when UPSTASH_REDIS_REST_URL +
//     UPSTASH_REDIS_REST_TOKEN are set — correct across a multi-pod fleet.
//   - In-memory sliding window fallback for dev / single-instance / tests.
//   - Production fail-CLOSED (503) when Upstash is unreachable: a Redis outage
//     must not re-open the email-bombing vector this guard exists to close.
//
// Exposed as a plain guard (not a tRPC middleware) because the key is derived
// from the mutation *input* (email), which is only available after Zod parsing
// — call it at the top of the `requestMagicLink` handler.

import { createHash } from 'node:crypto';
import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { MAGIC_LINK_RATE_LIMIT_EXCEEDED, MAGIC_LINK_RATE_LIMITER_UNAVAILABLE } from '../errors';
import { runtimeEnv, upstashToken, upstashUrl } from './raw-env';

const log = createLogger({ service: 'api', component: 'magic-link-rate-limit' });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const WINDOW_MS = 15 * 60_000; // 15 minutes
const MAX_REQUESTS = 5;
const FALLBACK_MAX_MAP_ENTRIES = 10_000;

// ---------------------------------------------------------------------------
// Upstash limiter (only when env configured)
// ---------------------------------------------------------------------------

const hasRedis = Boolean(upstashUrl && upstashToken);

const upstashLimiter: Ratelimit | null = hasRedis
  ? new Ratelimit({
      redis: new Redis({ url: upstashUrl as string, token: upstashToken as string }),
      // Upstash duration grammar: "15 m" → 15-minute sliding window.
      limiter: Ratelimit.slidingWindow(MAX_REQUESTS, '15 m'),
      prefix: 'magic-link:perEmail',
      analytics: false,
    })
  : null;

// ---------------------------------------------------------------------------
// In-memory fallback (dev / single-instance / tests)
// ---------------------------------------------------------------------------
//
// LRU-evicted on size cap (oldest `lastSeenMs` first). Stale entries are pruned
// on access — no setInterval (matches the upload/org-create precedents).

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

function fallbackCheck(key: string): { allowed: boolean } {
  const now = Date.now();
  const entry: FallbackEntry = fallbackMap.get(key) ?? { timestamps: [], lastSeenMs: now };

  entry.timestamps = entry.timestamps.filter(ts => now - ts < WINDOW_MS);
  entry.lastSeenMs = now;

  if (entry.timestamps.length >= MAX_REQUESTS) {
    fallbackMap.set(key, entry);
    return { allowed: false };
  }

  if (!fallbackMap.has(key) && fallbackMap.size >= FALLBACK_MAX_MAP_ENTRIES) {
    evictOldestLruEntry();
  }

  entry.timestamps.push(now);
  fallbackMap.set(key, entry);
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

/**
 * Throttle portal magic-link requests per email. Throws TOO_MANY_REQUESTS when
 * the cap is exceeded, or SERVICE_UNAVAILABLE in production when the limiter
 * backend is unreachable (fail-closed). Call before any DB lookup / email send.
 */
export async function enforceMagicLinkRateLimit(email: string): Promise<void> {
  const key = `magic-link:${hashEmail(email)}`;

  let allowed: boolean;

  if (upstashLimiter) {
    try {
      const result = await upstashLimiter.limit(key);
      allowed = result.success;
    } catch (err) {
      const env = runtimeEnv();
      if (env === 'production') {
        // Hash is already PII-free; log the key, never the address.
        log.error({ err, key }, 'upstash rate limiter unavailable — failing closed for magic link');
        throw new TRPCError({
          code: 'SERVICE_UNAVAILABLE',
          message: MAGIC_LINK_RATE_LIMITER_UNAVAILABLE,
        });
      }
      log.warn(
        { err, env, key },
        'upstash rate limiter unavailable — falling back to in-memory (non-prod only)',
      );
      allowed = fallbackCheck(key).allowed;
    }
  } else {
    allowed = fallbackCheck(key).allowed;
  }

  if (!allowed) {
    log.warn({ key }, 'portal magic-link request rate limit exceeded');
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: MAGIC_LINK_RATE_LIMIT_EXCEEDED,
    });
  }
}

/**
 * Testing helper — clears the in-memory fallback counter between tests so a
 * rate-limit burst in one test does not leak into the next.
 */
export function __resetMagicLinkRateLimitForTests(): void {
  fallbackMap.clear();
}

// ---------------------------------------------------------------------------
// Cache helper policy
// ---------------------------------------------------------------------------
// Two cache-aside helpers ship from this module — pick based on contention:
//   • cachedSingleflight() — hot path / dashboard / fan-in-heavy reads.
//     Redis SETNX-backed cross-instance singleflight prevents thundering-herd
//     on cold cache when N pods miss simultaneously.
//   • cached() — cool path / low-contention reads. In-process singleflight
//     only; cheaper, no extra Redis round-trip for the lock.
// ---------------------------------------------------------------------------

import { createLogger } from '@contractor-ops/logger';
import { getServerEnv } from '@contractor-ops/validators';
import { Redis } from '@upstash/redis';

const log = createLogger({ service: 'cache' });

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

let redis: Redis | null = null;

/**
 * Returns a singleton Upstash Redis client.
 * Returns null when env vars are missing (local dev without Redis).
 */
function getRedis(): Redis | null {
  if (redis) return redis;

  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = getServerEnv();

  if (!(url && token)) {
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

// ---------------------------------------------------------------------------
// Singleflight — prevents concurrent cache-miss fetches for the same key
// ---------------------------------------------------------------------------

const inflight = new Map<string, Promise<unknown>>();

// ---------------------------------------------------------------------------
// Cache key helpers
// ---------------------------------------------------------------------------

const KEY_PREFIX = 'co:'; // contractor-ops namespace

export function cacheKey(...segments: string[]): string {
  return KEY_PREFIX + segments.join(':');
}

// ---------------------------------------------------------------------------
// Core cache-aside with singleflight
// ---------------------------------------------------------------------------

// Sentinel value to distinguish "cached null" from "cache miss".
// Upstash returns null for both missing keys and stored null values,
// so we wrap nullable results in an envelope.
const CACHE_ENVELOPE = '__co_v' as const;
type CacheEnvelope<T> = { [CACHE_ENVELOPE]: T };

function wrap<T>(value: T): CacheEnvelope<T> {
  return { [CACHE_ENVELOPE]: value };
}

function unwrap<T>(envelope: CacheEnvelope<T>): T {
  return envelope[CACHE_ENVELOPE];
}

function isEnvelope<T>(value: unknown): value is CacheEnvelope<T> {
  return typeof value === 'object' && value !== null && CACHE_ENVELOPE in value;
}

/**
 * Cache-aside pattern with singleflight protection.
 *
 * 1. Attempts to read from Redis.
 * 2. On miss, runs `fn()` exactly once (singleflight dedup) and writes result
 *    to Redis with the given TTL.
 * 3. Falls back gracefully to `fn()` when Redis is unavailable.
 * 4. Properly caches null/undefined results using an envelope wrapper.
 */
export async function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  const client = getRedis();

  // No Redis → just call fn (with singleflight for concurrency)
  if (!client) {
    return singleflight(key, fn);
  }

  // 1. Try cache hit
  try {
    const hit = await client.get<CacheEnvelope<T>>(key);
    if (isEnvelope<T>(hit)) {
      return unwrap(hit);
    }
  } catch (err) {
    log.warn({ err }, 'redis GET failed, falling back to DB');
  }

  // 2. Cache miss → fetch with singleflight
  const result = await singleflight(key, fn);

  // 3. Write-back (fire-and-forget, don't block response)
  client.set(key, wrap(result), { ex: ttlSec }).catch(err => {
    log.warn({ err }, 'redis SET failed');
  });

  return result;
}

/**
 * Singleflight: if another caller is already fetching for this key,
 * piggyback on that promise instead of issuing a duplicate query.
 */
async function singleflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

// ---------------------------------------------------------------------------
// Cross-instance singleflight via Redis SETNX
// ---------------------------------------------------------------------------

/**
 * Cache-aside with a Redis-backed cross-instance lock + short response
 * cache. Designed for the dashboard KPI hot path: with 2-8 web pods, a
 * naïve `cached()` allows N parallel cold-cache misses to all run the 8
 * aggregation queries simultaneously, spiking writer CPU.
 *
 * Behaviour:
 *   1. Fast path — read the response cache; if present, return.
 *   2. Cache miss — try to acquire a Redis lock (SET key NX EX). If
 *      acquired we run `fn()`, write the result + release the lock, and
 *      return.
 *   3. Lock contention — another pod is computing. Poll the response
 *      cache every 50 ms up to `lockTtlSec`; once the winner writes, all
 *      losers return the cached value without doing the work. Fallback
 *      to `fn()` if the poll times out (winner crashed / OOM'd).
 *   4. Redis unavailable — degrade gracefully to in-process singleflight
 *      so single-pod deployments still work.
 *
 * `responseTtlSec` should be small (5-30 s) — this is for endpoints
 * where eventual consistency at the second-scale is acceptable
 * (dashboardKpis can tolerate 5 s of staleness easily).
 */
export async function cachedSingleflight<T>(
  key: string,
  responseTtlSec: number,
  fn: () => Promise<T>,
  lockTtlSec = 30,
): Promise<T> {
  const client = getRedis();
  if (!client) {
    return singleflight(key, fn);
  }

  // 1. Fast path — read the response cache.
  try {
    const hit = await client.get<CacheEnvelope<T>>(key);
    if (isEnvelope<T>(hit)) {
      return unwrap(hit);
    }
  } catch (err) {
    log.warn({ err }, 'redis GET failed (singleflight fast path)');
  }

  const lockKey = `${key}:lock`;

  // 2. Try to acquire the lock — `set ... NX EX` is atomic.
  let acquired = false;
  try {
    const setResult = await client.set(lockKey, '1', { nx: true, ex: lockTtlSec });
    acquired = setResult === 'OK';
  } catch (err) {
    log.warn({ err }, 'redis SET NX failed; falling back to in-process singleflight');
    return singleflight(key, fn);
  }

  if (acquired) {
    try {
      const result = await singleflight(key, fn);
      // Write response cache before releasing the lock — losers polling
      // the cache will see the value as soon as we publish it.
      try {
        await client.set(key, wrap(result), { ex: responseTtlSec });
      } catch (err) {
        log.warn({ err }, 'redis SET (response cache) failed');
      }
      return result;
    } finally {
      try {
        await client.del(lockKey);
      } catch (err) {
        log.warn({ err }, 'redis DEL (lock) failed; will expire via TTL');
      }
    }
  }

  // 3. Lock contention — poll the response cache.
  const pollStart = Date.now();
  const pollIntervalMs = 50;
  const pollDeadlineMs = lockTtlSec * 1000;

  while (Date.now() - pollStart < pollDeadlineMs) {
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    try {
      const hit = await client.get<CacheEnvelope<T>>(key);
      if (isEnvelope<T>(hit)) {
        return unwrap(hit);
      }
      // safe-swallow: a transient Redis read during lock-contention polling is non-fatal; the loop retries and falls back to local compute on timeout
    } catch {
      // Ignore — keep polling.
    }
  }

  // 4. Winner crashed — compute ourselves rather than block forever.
  log.warn({ key }, 'singleflight lock poll timed out; computing locally');
  return singleflight(key, fn);
}

// ---------------------------------------------------------------------------
// Invalidation
// ---------------------------------------------------------------------------

/**
 * Delete one or more cache keys.
 * Fire-and-forget — failures are logged but do not throw.
 */
export async function invalidate(...keys: string[]): Promise<void> {
  const client = getRedis();
  if (!client || keys.length === 0) return;

  try {
    await client.del(...keys);
  } catch (err) {
    log.warn({ err }, 'redis DEL failed');
  }
}

/**
 * Delete all keys matching a prefix using SCAN + DEL.
 * Use for broad invalidation (e.g. all dashboard keys for an org).
 * Fire-and-forget.
 */
export async function invalidateByPrefix(prefix: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    let cursor = 0;
    do {
      const [nextCursorStr, keys] = (await client.scan(cursor, {
        match: `${prefix}*`,
        count: 100,
      })) as unknown as [string, string[]];
      cursor = Number(nextCursorStr);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== 0);
  } catch (err) {
    log.warn({ err }, 'redis prefix invalidation failed');
  }
}

// ---------------------------------------------------------------------------
// Convenience: org-scoped keys
// ---------------------------------------------------------------------------
//
// INVARIANT: cache values stored under the keys below must NOT
// contain role-gated subsets. Every entry below holds the *full* org-scoped
// payload; the per-user authorisation check (`requirePermission`) MUST run
// BEFORE `cached()` is invoked, never after, so a low-privilege user can
// never observe data that a higher-privilege user populated into the cache.
//
// If you ever add a cache that intentionally holds a per-user view (e.g.
// taxId masked vs unmasked), include the role/permission discriminator in
// the cache key (`cacheKey(orgId, role, ...)`) — never the orgId alone.
// Search and dashboard caches today are role-agnostic by design: their
// payloads are aggregate/non-PII numbers and IDs that any user with the
// gating permission is entitled to see in full. Audited 2026-05-03.

export const CacheKeys = {
  // Org-scoped — orgId comes first so prefix invalidation works
  subscription: (orgId: string) => cacheKey(orgId, 'billing', 'sub'),
  creditBalance: (orgId: string) => cacheKey(orgId, 'billing', 'credits'),
  dashboardKpis: (orgId: string) => cacheKey(orgId, 'dash', 'kpis'),
  dashboardSpend: (orgId: string, months: string) => cacheKey(orgId, 'dash', 'spend', months),
  dashboardDeadlines: (orgId: string) => cacheKey(orgId, 'dash', 'deadlines'),
  dashboardActivity: (orgId: string) => cacheKey(orgId, 'dash', 'activity'),
  orgSettings: (orgId: string) => cacheKey(orgId, 'settings', 'org'),
  orgSettingsJson: (orgId: string, sub: string) => cacheKey(orgId, 'settings', 'json', sub),
  orgBranding: (orgId: string) => cacheKey(orgId, 'settings', 'branding'),
  approvalChains: (orgId: string) => cacheKey(orgId, 'approval', 'chains'),
  // IdP impact preview (org-scoped; keyed by provider + external user id).
  idpPreview: (orgId: string, provider: string, externalUserId: string) =>
    cacheKey(orgId, 'idp', 'preview', provider, externalUserId),

  // Prefix patterns for broad invalidation (match all keys for an org+domain)
  dashboardPrefix: (orgId: string) => cacheKey(orgId, 'dash'),
  settingsPrefix: (orgId: string) => cacheKey(orgId, 'settings'),
  billingPrefix: (orgId: string) => cacheKey(orgId, 'billing'),
} as const;

// ---------------------------------------------------------------------------
// TTL constants (seconds)
// ---------------------------------------------------------------------------

export const CacheTTL = {
  /** Billing subscription — stable, invalidated on webhook */
  SUBSCRIPTION: 15 * 60,
  /** OCR credit balance — changes on usage, invalidated explicitly */
  CREDIT_BALANCE: 5 * 60,
  /** Dashboard KPIs — acceptable 5 min staleness */
  DASHBOARD_KPIS: 5 * 60,
  /**
   * Short response cache used with `cachedSingleflight` for the
   * dashboard KPIs hot path. 5 seconds is long enough to absorb burst
   * traffic across the fleet but short enough that the user perceives
   * the dashboard as live.
   */
  DASHBOARD_KPIS_BURST: 5,
  /** Spend trend — historical data, higher staleness OK */
  DASHBOARD_SPEND: 10 * 60,
  /** Deadlines — moderate staleness */
  DASHBOARD_DEADLINES: 3 * 60,
  /** Activity feed — recent events, lower TTL */
  DASHBOARD_ACTIVITY: 2 * 60,
  /** Organization settings — stable, invalidated on update */
  ORG_SETTINGS: 15 * 60,
  /** Organization settings JSON (expiry, invoice thresholds) */
  ORG_SETTINGS_JSON: 30 * 60,
  /** Branding — very stable */
  ORG_BRANDING: 30 * 60,
  /** Approval chain configs — stable, invalidated on CRUD */
  APPROVAL_CHAINS: 10 * 60,
  /** IdP impact preview — 5 min staleness; "Refresh" button force-invalidates. */
  IDP_PREVIEW: 5 * 60,
} as const;

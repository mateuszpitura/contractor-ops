import { Redis } from '@upstash/redis';

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

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

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
    console.warn('[cache] Redis GET failed, falling back to DB:', err);
  }

  // 2. Cache miss → fetch with singleflight
  const result = await singleflight(key, fn);

  // 3. Write-back (fire-and-forget, don't block response)
  client.set(key, wrap(result), { ex: ttlSec }).catch(err => {
    console.warn('[cache] Redis SET failed:', err);
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
    console.warn('[cache] Redis DEL failed:', err);
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
    console.warn('[cache] Redis prefix invalidation failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Convenience: org-scoped keys
// ---------------------------------------------------------------------------

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
} as const;

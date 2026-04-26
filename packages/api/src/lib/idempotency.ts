/**
 * Distributed idempotency cache backed by Upstash Redis with an in-memory
 * fallback. Safe to use across horizontally scaled instances — two
 * concurrent requests carrying the same key land on the same Redis entry.
 *
 * Semantics:
 *   - `PENDING` sentinel is written immediately on the first call; a second
 *     call arriving before the first has completed sees PENDING and can
 *     choose to 409 (caller's decision).
 *   - On success, the PENDING sentinel is replaced with the serialized
 *     result and a TTL.
 *   - On failure, the reservation is cleared so the key can be retried.
 *
 * The in-memory fallback is best-effort only — on a multi-instance deploy
 * without Redis, two pods can both proceed. Production deployments MUST
 * configure Upstash.
 */

import { Redis } from '@upstash/redis';

const KEY_PREFIX = 'co_idem:';
const PENDING_SENTINEL = '__PENDING__';

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis: Redis | null =
  upstashUrl && upstashToken ? new Redis({ url: upstashUrl, token: upstashToken }) : null;

// --- In-memory fallback (dev / single-instance / tests) ---
type MemEntry = { value: string; expiresAtMs: number };
const memStore = new Map<string, MemEntry>();

function memGet(key: string): string | null {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAtMs) {
    memStore.delete(key);
    return null;
  }
  return entry.value;
}

function memSet(key: string, value: string, ttlSeconds: number): void {
  memStore.set(key, {
    value,
    expiresAtMs: Date.now() + ttlSeconds * 1_000,
  });
}

function memSetIfAbsent(key: string, value: string, ttlSeconds: number): boolean {
  const existing = memGet(key);
  if (existing !== null) return false;
  memSet(key, value, ttlSeconds);
  return true;
}

function memDel(key: string): void {
  memStore.delete(key);
}

export type IdempotencyHit<T> = { kind: 'MISS' } | { kind: 'PENDING' } | { kind: 'HIT'; result: T };

/**
 * Reserve an idempotency key or return the cached result. Returns:
 *   - MISS: no prior reservation; caller should proceed and then call
 *     `complete` with the result, or `clear` on failure.
 *   - PENDING: another worker is already executing this key.
 *   - HIT: cached result available, return it directly.
 */
export async function reserve<T>(rawKey: string, ttlSeconds: number): Promise<IdempotencyHit<T>> {
  const key = KEY_PREFIX + rawKey;

  if (redis) {
    try {
      // NX: only set if key does not exist. Returns 'OK' on success, null on collision.
      const setResult = await redis.set(key, PENDING_SENTINEL, {
        nx: true,
        ex: ttlSeconds,
      });
      if (setResult === 'OK') {
        return { kind: 'MISS' };
      }
      const existing = await redis.get<string>(key);
      if (existing === PENDING_SENTINEL) return { kind: 'PENDING' };
      if (typeof existing === 'string') {
        return { kind: 'HIT', result: JSON.parse(existing) as T };
      }
      // Upstash can return parsed objects if a JS value was stored; treat as HIT.
      if (existing && typeof existing === 'object') {
        return { kind: 'HIT', result: existing as T };
      }
      // Key vanished between set-NX and get (race on TTL boundary) — retry as MISS.
      return { kind: 'MISS' };
    } catch {
      // Redis transient error → fall through to in-memory fallback.
    }
  }

  const reserved = memSetIfAbsent(key, PENDING_SENTINEL, ttlSeconds);
  if (reserved) return { kind: 'MISS' };

  const existing = memGet(key);
  if (existing === PENDING_SENTINEL) return { kind: 'PENDING' };
  if (existing !== null) {
    return { kind: 'HIT', result: JSON.parse(existing) as T };
  }
  return { kind: 'MISS' };
}

/** Write the completed result, overwriting the PENDING sentinel. */
export async function complete<T>(rawKey: string, result: T, ttlSeconds: number): Promise<void> {
  const key = KEY_PREFIX + rawKey;
  const serialized = JSON.stringify(result);
  if (redis) {
    try {
      await redis.set(key, serialized, { ex: ttlSeconds });
      return;
    } catch {
      // fall through
    }
  }
  memSet(key, serialized, ttlSeconds);
}

/** Clear the reservation so the key can be retried after a failure. */
export async function clear(rawKey: string): Promise<void> {
  const key = KEY_PREFIX + rawKey;
  if (redis) {
    try {
      await redis.del(key);
      return;
    } catch {
      // fall through
    }
  }
  memDel(key);
}

/** Testing helper — clears in-memory fallback between tests. */
export function __resetIdempotencyForTests(): void {
  memStore.clear();
}

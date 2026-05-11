/**
 * Idempotency module — in-memory fallback path.
 *
 * We exercise the MISS → PENDING → HIT transitions plus the TTL and `clear`
 * behaviors. We unset the Upstash env vars before the module-under-test is
 * imported, which makes its internal `redis` const null and routes every
 * call to the in-memory store. (Leaving real credentials in the env would
 * cause tests to either hang on network I/O or mutate a real KV store.)
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Force the in-memory fallback path. The module reads these at import time
// and caches the result in a module-scoped `redis` singleton, so the delete
// must happen before `../idempotency.js` is dynamically imported below.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

let ResetIdempotencyForTests: () => void;
let clear: (rawKey: string) => Promise<void>;
let complete: <T>(rawKey: string, result: T, ttlSeconds: number) => Promise<void>;
let reserve: <T>(
  rawKey: string,
  ttlSeconds: number,
) => Promise<{ kind: 'MISS' } | { kind: 'PENDING' } | { kind: 'HIT'; result: T }>;

beforeAll(async () => {
  const mod = await import('../idempotency');
  ResetIdempotencyForTests = mod.__resetIdempotencyForTests;
  clear = mod.clear;
  complete = mod.complete;
  reserve = mod.reserve;
});

const TTL = 60;

beforeEach(() => {
  ResetIdempotencyForTests();
});

afterEach(() => {
  ResetIdempotencyForTests();
});

describe('idempotency', () => {
  describe('reserve()', () => {
    it('returns MISS on first call for a fresh key', async () => {
      const result = await reserve<{ id: string }>('key-1', TTL);
      expect(result).toEqual({ kind: 'MISS' });
    });

    it('returns PENDING on a second call while no complete() has landed', async () => {
      const first = await reserve('key-2', TTL);
      expect(first.kind).toBe('MISS');

      const second = await reserve('key-2', TTL);
      expect(second.kind).toBe('PENDING');
    });

    it('returns HIT once complete() has been called with the result', async () => {
      await reserve('key-3', TTL);
      await complete('key-3', { id: 'run-1' }, TTL);

      const next = await reserve<{ id: string }>('key-3', TTL);
      expect(next).toEqual({ kind: 'HIT', result: { id: 'run-1' } });
    });

    it('isolates distinct keys', async () => {
      const a = await reserve('alpha', TTL);
      const b = await reserve('beta', TTL);
      expect(a.kind).toBe('MISS');
      expect(b.kind).toBe('MISS');
    });

    it('expires entries after the TTL elapses', async () => {
      await reserve('key-4', 0);
      await new Promise(resolve => setTimeout(resolve, 5));
      const next = await reserve('key-4', TTL);
      expect(next.kind).toBe('MISS');
    });
  });

  describe('complete()', () => {
    it('overwrites the PENDING sentinel so subsequent reserve() HITs', async () => {
      await reserve('key-5', TTL);
      // Before complete, a second reserve sees PENDING.
      const pending = await reserve('key-5', TTL);
      expect(pending.kind).toBe('PENDING');

      await complete('key-5', { ok: true }, TTL);
      const hit = await reserve<{ ok: boolean }>('key-5', TTL);
      expect(hit).toEqual({ kind: 'HIT', result: { ok: true } });
    });

    it('survives round-trip through JSON.stringify', async () => {
      await reserve('key-6', TTL);
      const payload = {
        runs: [{ id: 'r1', total: 1000 }],
        timestamp: '2026-04-22T00:00:00.000Z',
      };
      await complete('key-6', payload, TTL);
      const hit = await reserve<typeof payload>('key-6', TTL);
      expect(hit).toEqual({ kind: 'HIT', result: payload });
    });
  });

  describe('clear()', () => {
    it('removes the reservation so the key can be retried', async () => {
      await reserve('key-7', TTL);
      // Failure path: caller clears.
      await clear('key-7');

      const retry = await reserve('key-7', TTL);
      expect(retry.kind).toBe('MISS');
    });

    it('is safe to call on a non-existent key', async () => {
      await expect(clear('never-reserved')).resolves.toBeUndefined();
    });
  });

  describe('failure → retry flow', () => {
    it('supports the pattern used by the payment router (reserve → failure → clear → retry)', async () => {
      // First attempt fails.
      const first = await reserve('run-key', TTL);
      expect(first.kind).toBe('MISS');
      // Simulate failure before complete().
      await clear('run-key');

      // Retry succeeds this time.
      const retry = await reserve('run-key', TTL);
      expect(retry.kind).toBe('MISS');
      await complete('run-key', { id: 'run-42' }, TTL);

      const after = await reserve<{ id: string }>('run-key', TTL);
      expect(after).toEqual({ kind: 'HIT', result: { id: 'run-42' } });
    });
  });
});

/**
 * Integration: @upstash/redis + MSW in-memory REST (real cached() path, not vi.mock Redis).
 */
import { clearRedisStore, createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { minimalServerEnv } from '@contractor-ops/validators/minimal-server-env';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['upstashRedis']),
});

beforeAll(() =>
  server.listen({
    onUnhandledRequest: 'warn',
  }),
);
afterEach(() => {
  clearRedisStore();
  server.resetHandlers();
});
afterAll(() => server.close());

async function withFreshCacheModule<T>(
  run: (mod: typeof import('../cache')) => Promise<T>,
): Promise<T> {
  const prevUrl = process.env.UPSTASH_REDIS_REST_URL;
  const prevToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  Object.assign(process.env, minimalServerEnv(), {
    UPSTASH_REDIS_REST_URL: 'https://cache-msw-integration.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'cache-msw-token',
  });
  vi.resetModules();
  try {
    const mod = await import('../cache');
    return await run(mod);
  } finally {
    if (prevUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = prevUrl;
    if (prevToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = prevToken;
    vi.resetModules();
  }
}

describe('cache + MSW (Upstash Redis)', () => {
  it('second cached() call reuses value without re-running fn', async () => {
    await withFreshCacheModule(async ({ cached }) => {
      let runs = 0;
      const fn = async () => {
        runs += 1;
        return `v-${runs}`;
      };

      const key = 'co:msw:integration:probe';
      const first = await cached(key, 300, fn);
      const second = await cached(key, 300, fn);

      expect(first).toBe('v-1');
      expect(second).toBe('v-1');
      expect(runs).toBe(1);
    });
  });

  it('invalidate() removes key so cached() runs fn again', async () => {
    await withFreshCacheModule(async ({ cached, invalidate }) => {
      let runs = 0;
      const fn = async () => {
        runs += 1;
        return `v-${runs}`;
      };

      const key = 'co:msw:integration:inv';
      await cached(key, 300, fn);
      await cached(key, 300, fn);
      expect(runs).toBe(1);

      await invalidate(key);
      const after = await cached(key, 300, fn);

      expect(after).toBe('v-2');
      expect(runs).toBe(2);
    });
  });

  it('invalidateByPrefix() uses SCAN+DEL so keys under prefix miss on next cached()', async () => {
    await withFreshCacheModule(async ({ cached, invalidateByPrefix }) => {
      let runs = 0;
      const fn = async () => {
        runs += 1;
        return `v-${runs}`;
      };

      const prefix = 'co:msw:integration:pfx';
      const k1 = `${prefix}:a`;
      const k2 = `${prefix}:b`;

      await cached(k1, 300, fn);
      await cached(k2, 300, fn);
      await cached(k1, 300, fn);
      await cached(k2, 300, fn);
      expect(runs).toBe(2);

      await invalidateByPrefix(prefix);

      await cached(k1, 300, fn);
      await cached(k2, 300, fn);
      expect(runs).toBe(4);
    });
  });
});

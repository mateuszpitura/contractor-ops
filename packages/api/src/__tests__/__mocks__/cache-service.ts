import { vi } from 'vitest';

type CacheModule = typeof import('../../services/cache');

/**
 * Passthrough cache mock: keeps production CacheKeys / CacheTTL while
 * stubbing Redis-backed helpers.
 */
export function createPassthroughCacheMock(
  actual: CacheModule,
  overrides: Partial<CacheModule> = {},
) {
  return {
    ...actual,
    cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
    cachedSingleflight: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
    invalidate: vi.fn(async () => undefined),
    invalidateByPrefix: vi.fn(async () => undefined),
    ...overrides,
  };
}

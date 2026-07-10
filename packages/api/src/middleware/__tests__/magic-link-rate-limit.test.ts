import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Force the in-memory fallback path by clearing Upstash env BEFORE the
// middleware module is evaluated (its `hasRedis` flag is module-scoped).
vi.hoisted(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

vi.mock('@contractor-ops/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  })),
}));

import {
  __resetMagicLinkRateLimitForTests,
  enforceMagicLinkRateLimit,
} from '../magic-link-rate-limit';

describe('enforceMagicLinkRateLimit', () => {
  beforeEach(() => {
    __resetMagicLinkRateLimitForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows the first 5 requests per email in the window', async () => {
    const email = `bomb-${Math.random().toString(36).slice(2)}@example.com`;
    for (let i = 0; i < 5; i++) {
      await expect(enforceMagicLinkRateLimit(email)).resolves.toBeUndefined();
    }
  });

  it('throws TOO_MANY_REQUESTS on the 6th request in the same window', async () => {
    const email = `bomb6-${Math.random().toString(36).slice(2)}@example.com`;
    for (let i = 0; i < 5; i++) {
      await enforceMagicLinkRateLimit(email);
    }
    await expect(enforceMagicLinkRateLimit(email)).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
  });

  it('keys on the normalized email so case/whitespace variants share a counter', async () => {
    const base = `Case-${Math.random().toString(36).slice(2)}@Example.COM`;
    for (let i = 0; i < 5; i++) {
      await enforceMagicLinkRateLimit(base);
    }
    // Same address, different casing / surrounding whitespace — must be capped.
    await expect(enforceMagicLinkRateLimit(`  ${base.toLowerCase()} `)).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
  });

  it('tracks different emails with separate counters', async () => {
    const a = `a-${Math.random().toString(36).slice(2)}@example.com`;
    const b = `b-${Math.random().toString(36).slice(2)}@example.com`;
    for (let i = 0; i < 5; i++) {
      await enforceMagicLinkRateLimit(a);
    }
    await expect(enforceMagicLinkRateLimit(a)).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
    // A different email starts fresh.
    await expect(enforceMagicLinkRateLimit(b)).resolves.toBeUndefined();
  });

  it('allows requests again after the 15-minute window expires', async () => {
    const email = `win-${Math.random().toString(36).slice(2)}@example.com`;
    let now = Date.now();
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => now);

    for (let i = 0; i < 5; i++) {
      await enforceMagicLinkRateLimit(email);
    }
    await expect(enforceMagicLinkRateLimit(email)).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });

    // Advance past the 15-minute window — all timestamps expire.
    now += 15 * 60_000 + 1_000;
    await expect(enforceMagicLinkRateLimit(email)).resolves.toBeUndefined();

    spy.mockRestore();
  });
});

/**
 * Regression coverage for the public-API rate limiter, exercised through the
 * fully-assembled Hono app (app.ts) rather than the middleware in isolation.
 *
 * This asserts the limiter as it is actually wired: rateLimitMiddleware runs
 * `app.use('*', ...)` ahead of every route, keyed on the Authorization header
 * (Bearer co_live_<random> → first 12 chars of <random>). With the Upstash
 * env unset in the test process, the in-memory sliding-window fallback runs
 * (X-RateLimit-Store: memory), so these tests are deterministic and need no
 * network backend.
 *
 * The limiter's `windows` Map is module-level with no reset export, so each
 * test uses a DISTINCT API key — exhausting one key cannot bleed into another
 * (which is also exactly the per-key isolation guarantee under test).
 *
 * Mirrors app.test.ts: static `import app from '../app.js'`, hoisted stubs for
 * createPublicCaller + the logger so guarded routes resolve without a real
 * DB/tRPC backend.
 *
 * The production fail-CLOSED 503 path (Upstash present + .limit() throws +
 * NODE_ENV=production, rate-limiter.ts ~140-155) is intentionally NOT covered
 * here: it needs Upstash env set at module-load time, an unreachable backend,
 * and prod mode — none of which compose with this file's static app import
 * (prod also makes parseAllowedOrigins() require PUBLIC_API_CORS_ORIGINS at
 * load). It belongs to the live harness.
 */

import { describe, expect, it, vi } from 'vitest';

const { mockCallerStub } = vi.hoisted(() => {
  const mockCallerStub = {
    invoice: {
      list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
      getById: vi.fn(),
    },
    contract: {
      list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
      getById: vi.fn(),
    },
    contractor: {
      list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
      getById: vi.fn(),
    },
    document: {
      list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
      getDownloadUrl: vi.fn(),
    },
    featureFlags: { list: vi.fn().mockResolvedValue([]) },
  };
  return { mockCallerStub };
});

vi.mock('../lib/create-caller.js', () => ({
  createPublicCaller: vi.fn(() => mockCallerStub),
}));

vi.mock('@contractor-ops/logger', () => {
  const stub = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  };
  const loggerStub = { ...stub, child: vi.fn(() => ({ ...stub, child: vi.fn(() => stub) })) };
  return {
    logger: loggerStub,
    createTrpcLogger: vi.fn(() => stub),
    createLogger: vi.fn(() => loggerStub),
    createCronLogger: vi.fn(() => stub),
    createWebhookLogger: vi.fn(() => stub),
    createIntegrationLogger: vi.fn(() => stub),
  };
});

import app from '../app.js';

// Limiter constants mirrored from rate-limiter.ts. The per-key cap is a
// hardcoded module constant (NOT env-configurable), so over-limit tests must
// loop past 100 rather than shrink the limit via env.
const LIMIT = 100;
const GUARDED_ROUTE = '/api/v1/contractors';

/** Build the Authorization header the limiter keys on. */
function bearer(suffix: string) {
  return { Authorization: `Bearer co_live_${suffix}` };
}

// ---------------------------------------------------------------------------
// Scenario 1 — under-limit requests succeed; X-RateLimit-Remaining decrements.
// ---------------------------------------------------------------------------

describe('rate limiter — under-limit behaviour', () => {
  it('serves guarded route with 200 and decrementing X-RateLimit-Remaining', async () => {
    // Keys are bucketed on the first 12 chars of the random suffix, so every
    // test below uses a leading-12-char-DISTINCT key to stay isolated.
    const key = 'k1-under-dec-decrement';

    const first = await app.request(GUARDED_ROUTE, { headers: bearer(key) });
    const second = await app.request(GUARDED_ROUTE, { headers: bearer(key) });
    const third = await app.request(GUARDED_ROUTE, { headers: bearer(key) });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);

    // Guards the whole file's premise: with no Upstash env the in-memory
    // fallback runs, so the deterministic loops below count locally rather
    // than hitting a real backend. If this flips to 'redis' the env leaked.
    expect(first.headers.get('x-ratelimit-store')).toBe('memory');

    const r1 = Number(first.headers.get('x-ratelimit-remaining'));
    const r2 = Number(second.headers.get('x-ratelimit-remaining'));
    const r3 = Number(third.headers.get('x-ratelimit-remaining'));

    // First request consumes slot 1 → remaining = LIMIT - 1, then strictly
    // decreasing by one per request.
    expect(r1).toBe(LIMIT - 1);
    expect(r2).toBe(LIMIT - 2);
    expect(r3).toBe(LIMIT - 3);
  });

  it('advertises the per-key limit via X-RateLimit-Limit on a 200', async () => {
    const key = 'k2-under-hdr-limit-header';
    const res = await app.request(GUARDED_ROUTE, { headers: bearer(key) });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-ratelimit-limit')).toBe(String(LIMIT));
  });

  it('serves the LIMIT-th request (boundary) with 200 and remaining 0', async () => {
    const key = 'k3-under-bnd-boundary';
    let res = await app.request(GUARDED_ROUTE, { headers: bearer(key) });
    for (let i = 1; i < LIMIT; i++) {
      res = await app.request(GUARDED_ROUTE, { headers: bearer(key) });
    }
    // The LIMIT-th request is the last allowed one (count <= LIMIT).
    expect(res.status).toBe(200);
    expect(res.headers.get('x-ratelimit-remaining')).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — exceeding the per-key limit returns 429 with the right headers.
// ---------------------------------------------------------------------------

describe('rate limiter — over-limit enforcement', () => {
  it('returns 429 once the per-key limit is exceeded', async () => {
    const key = 'k4-over-429-exceeded';
    for (let i = 0; i < LIMIT; i++) {
      await app.request(GUARDED_ROUTE, { headers: bearer(key) });
    }
    const blocked = await app.request(GUARDED_ROUTE, { headers: bearer(key) });

    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as { error: { code: string; status: number } };
    expect(body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(body.error.status).toBe(429);
  });

  it('emits X-RateLimit-Limit / Remaining:0 / Reset / Retry-After on the 429', async () => {
    const key = 'k5-over-hdr-headers';
    for (let i = 0; i < LIMIT; i++) {
      await app.request(GUARDED_ROUTE, { headers: bearer(key) });
    }
    const blocked = await app.request(GUARDED_ROUTE, { headers: bearer(key) });

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('x-ratelimit-limit')).toBe(String(LIMIT));
    expect(blocked.headers.get('x-ratelimit-remaining')).toBe('0');

    const reset = blocked.headers.get('x-ratelimit-reset');
    expect(reset).not.toBeNull();
    // Reset is a unix-seconds timestamp in the future (window end).
    expect(Number(reset)).toBeGreaterThan(0);

    const retryAfter = blocked.headers.get('retry-after');
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3 — per-key isolation: one key's exhaustion does not throttle another.
// ---------------------------------------------------------------------------

describe('rate limiter — per-key isolation', () => {
  it('does not throttle a second distinct key when the first is exhausted', async () => {
    const exhausted = 'k6-iso-exhausted';
    const fresh = 'k7-iso-fresh-untouched';

    for (let i = 0; i < LIMIT; i++) {
      await app.request(GUARDED_ROUTE, { headers: bearer(exhausted) });
    }

    const blocked = await app.request(GUARDED_ROUTE, { headers: bearer(exhausted) });
    expect(blocked.status).toBe(429);

    // The untouched key still has its full window.
    const allowed = await app.request(GUARDED_ROUTE, { headers: bearer(fresh) });
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('x-ratelimit-remaining')).toBe(String(LIMIT - 1));
  });

  it('keys on the Authorization prefix, not the full token: two keys sharing the first 12 random chars collide', async () => {
    // extractRateLimitKey buckets on co_live_ + first 12 chars of the random
    // suffix. Two tokens that share that 12-char prefix but differ afterward
    // are deliberately the SAME bucket — assert that documented behaviour so a
    // future widening of the key window is caught.
    const sharedPrefix = 'collide12chr'; // exactly 12 chars
    for (let i = 0; i < LIMIT; i++) {
      await app.request(GUARDED_ROUTE, { headers: bearer(`${sharedPrefix}AAAA`) });
    }
    const blocked = await app.request(GUARDED_ROUTE, { headers: bearer(`${sharedPrefix}BBBB`) });
    expect(blocked.status).toBe(429);
  });
});

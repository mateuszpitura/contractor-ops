/**
 * Unit tests for rate-limiter.ts (in-memory fallback path only).
 *
 * extractRateLimitKey and fallbackLimit are NOT exported — they are tested
 * indirectly through the rateLimitMiddleware Hono middleware.
 *
 * The module reads UPSTASH_* at import time, so each describe block that
 * needs isolation uses vi.resetModules() + dynamic import after stubbing env.
 */

import type { MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a tiny Hono app that attaches middleware under test and serves /test */
async function buildApp(middleware: MiddlewareHandler) {
  const app = new Hono();
  app.use('*', middleware);
  app.get('/test', c => c.json({ ok: true }));
  return app;
}

function bearerHeader(suffix: string) {
  return { Authorization: `Bearer co_live_${suffix}` };
}

// ---------------------------------------------------------------------------
// rateLimitMiddleware — key extraction behaviour
// ---------------------------------------------------------------------------

describe('rateLimitMiddleware — key extraction', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not rate-limit when Authorization header is absent (calls next, returns 200)', async () => {
    const { rateLimitMiddleware } = await import('../rate-limiter.js');
    const app = await buildApp(rateLimitMiddleware);
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });

  it('does not rate-limit when Bearer token does not have co_live_ prefix', async () => {
    const { rateLimitMiddleware } = await import('../rate-limiter.js');
    const app = await buildApp(rateLimitMiddleware);
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer sk_test_notakey' },
    });
    expect(res.status).toBe(200);
  });

  it('applies rate-limiting for valid Bearer co_live_ token', async () => {
    const { rateLimitMiddleware } = await import('../rate-limiter.js');
    const app = await buildApp(rateLimitMiddleware);
    const res = await app.request('/test', { headers: bearerHeader('validkeytest') });
    // Should pass (not yet at limit)
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// rateLimitMiddleware — in-memory limit enforcement
// ---------------------------------------------------------------------------

describe('rateLimitMiddleware — in-memory limit enforcement', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows requests 1-100 (the 100th still returns 200)', async () => {
    const { rateLimitMiddleware } = await import('../rate-limiter.js');
    const app = await buildApp(rateLimitMiddleware);
    const key = 'limittest001'; // unique per test block (module is reset)
    for (let i = 0; i < 99; i++) {
      await app.request('/test', { headers: bearerHeader(key) });
    }
    const res = await app.request('/test', { headers: bearerHeader(key) });
    expect(res.status).toBe(200);
  });

  it('blocks the 101st request with 429', async () => {
    const { rateLimitMiddleware } = await import('../rate-limiter.js');
    const app = await buildApp(rateLimitMiddleware);
    const key = 'limittest002';
    for (let i = 0; i < 100; i++) {
      await app.request('/test', { headers: bearerHeader(key) });
    }
    const res = await app.request('/test', { headers: bearerHeader(key) });
    expect(res.status).toBe(429);
  });

  it('includes Retry-After header on 429 response', async () => {
    const { rateLimitMiddleware } = await import('../rate-limiter.js');
    const app = await buildApp(rateLimitMiddleware);
    const key = 'limittest003';
    for (let i = 0; i < 100; i++) {
      await app.request('/test', { headers: bearerHeader(key) });
    }
    const res = await app.request('/test', { headers: bearerHeader(key) });
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('includes X-RateLimit-Remaining: 0 on 429 response', async () => {
    const { rateLimitMiddleware } = await import('../rate-limiter.js');
    const app = await buildApp(rateLimitMiddleware);
    const key = 'limittest004';
    for (let i = 0; i < 100; i++) {
      await app.request('/test', { headers: bearerHeader(key) });
    }
    const res = await app.request('/test', { headers: bearerHeader(key) });
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('sets X-RateLimit-Limit: 100 header on normal (non-blocked) response', async () => {
    const { rateLimitMiddleware } = await import('../rate-limiter.js');
    const app = await buildApp(rateLimitMiddleware);
    const res = await app.request('/test', { headers: bearerHeader('limittest005') });
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
  });

  it('sets X-RateLimit-Remaining header on a normal response', async () => {
    const { rateLimitMiddleware } = await import('../rate-limiter.js');
    const app = await buildApp(rateLimitMiddleware);
    const res = await app.request('/test', { headers: bearerHeader('limittest006') });
    const remaining = res.headers.get('X-RateLimit-Remaining');
    expect(remaining).not.toBeNull();
    expect(Number(remaining)).toBeGreaterThanOrEqual(0);
  });

  it('returns 200 for a different key even when another key is exhausted', async () => {
    const { rateLimitMiddleware } = await import('../rate-limiter.js');
    const app = await buildApp(rateLimitMiddleware);
    const exhaustedKey = 'limittest007';
    const otherKey = 'limittest008';
    for (let i = 0; i < 100; i++) {
      await app.request('/test', { headers: bearerHeader(exhaustedKey) });
    }
    // First exhausted
    const blocked = await app.request('/test', { headers: bearerHeader(exhaustedKey) });
    expect(blocked.status).toBe(429);
    // Different key not affected
    const allowed = await app.request('/test', { headers: bearerHeader(otherKey) });
    expect(allowed.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// rateLimitMiddleware — window reset after 60s (fake timers)
// ---------------------------------------------------------------------------

describe('rateLimitMiddleware — window reset', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('allows requests again after the 60s window expires', async () => {
    const { rateLimitMiddleware } = await import('../rate-limiter.js');
    const app = await buildApp(rateLimitMiddleware);
    const key = 'limittestReset001';
    // Exhaust the window
    for (let i = 0; i < 100; i++) {
      await app.request('/test', { headers: bearerHeader(key) });
    }
    // Confirm blocked
    const blocked = await app.request('/test', { headers: bearerHeader(key) });
    expect(blocked.status).toBe(429);
    // Advance time past the window
    vi.advanceTimersByTime(61_000);
    // Should be allowed again
    const allowed = await app.request('/test', { headers: bearerHeader(key) });
    expect(allowed.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// MAX_WINDOWS eviction — note
// ---------------------------------------------------------------------------
// TODO: MAX_WINDOWS (50_000) eviction test is omitted because filling 50k keys
// in a unit test is impractically heavy and the module does not export a way to
// override MAX_WINDOWS. The eviction code (lines ~62–73 of rate-limiter.ts) is
// covered by code inspection. A smoke test would require either exporting
// a setMaxWindows() hook or running the test with a forked process and smaller
// override.

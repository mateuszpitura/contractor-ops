/**
 * Unit tests for `qstash-backpressure` (S3-4 / F-SCALE-19).
 *
 * Covers the production-critical contracts of `withBackpressure`:
 *   - happy-path pass-through under capacity
 *   - rejection with `BackpressureRejectedError` at capacity
 *   - DECR on success, throw, and rejection paths (no slot leaks)
 *   - per-route counter isolation (different routeKeys are independent)
 *   - fail-OPEN on Redis errors (deliberate, see qstash-backpressure.ts:158-161)
 *   - TTL leak guard via EXPIRE on every INCR
 *
 * The Sentry escalation path in `onRejected` is exercised indirectly (it's an
 * internal observability detail) — the focus here is the request-path
 * invariants every consumer route depends on.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state — Redis client + Sentry capture
// ---------------------------------------------------------------------------

const { mockIncr, mockDecr, mockExpire, mockGet, mockCaptureMessage, mockMetricsIncrement } =
  vi.hoisted(() => ({
    mockIncr: vi.fn(),
    mockDecr: vi.fn().mockResolvedValue(0),
    mockExpire: vi.fn().mockResolvedValue(1),
    mockGet: vi.fn().mockResolvedValue(null),
    mockCaptureMessage: vi.fn(),
    mockMetricsIncrement: vi.fn(),
  }));

vi.mock('@upstash/redis', () => {
  class MockRedis {
    incr = mockIncr;
    decr = mockDecr;
    expire = mockExpire;
    get = mockGet;
  }
  return { Redis: MockRedis };
});

vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: () => ({
    UPSTASH_REDIS_REST_URL: 'https://fake-redis.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'fake-token',
  }),
}));

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

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: mockMetricsIncrement },
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: mockCaptureMessage,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks) — `withBackpressure` captures the Redis singleton on
// first call, so tests must reset module state between fail-open / fail-closed
// scenarios via `vi.resetModules()` where needed.
// ---------------------------------------------------------------------------

import {
  BackpressureRejectedError,
  backpressureKey,
  isBackpressureRejected,
  withBackpressure,
} from '../qstash-backpressure.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset only mock call history — keep default resolved values.
  mockIncr.mockReset();
  mockDecr.mockReset().mockResolvedValue(0);
  mockExpire.mockReset().mockResolvedValue(1);
  mockGet.mockReset().mockResolvedValue(null);
  mockCaptureMessage.mockReset();
  mockMetricsIncrement.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// backpressureKey — namespace contract is consumed by health probe + cron
// ---------------------------------------------------------------------------

describe('backpressureKey', () => {
  it('encodes route into the canonical Redis key', () => {
    expect(backpressureKey('ocr-process')).toBe('qstash:backpressure:ocr-process');
  });
});

// ---------------------------------------------------------------------------
// BackpressureRejectedError — typed marker consumed by routes
// ---------------------------------------------------------------------------

describe('BackpressureRejectedError', () => {
  it('preserves the routeKey and a default Retry-After of 5s', () => {
    const err = new BackpressureRejectedError('ocr-process');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('BackpressureRejectedError');
    expect(err.routeKey).toBe('ocr-process');
    expect(err.retryAfterSec).toBe(5);
  });

  it('respects a custom Retry-After value', () => {
    const err = new BackpressureRejectedError('peppol-outbound', 30);
    expect(err.retryAfterSec).toBe(30);
  });

  it('isBackpressureRejected narrows the type for unknown errors', () => {
    expect(isBackpressureRejected(new BackpressureRejectedError('x'))).toBe(true);
    expect(isBackpressureRejected(new Error('boom'))).toBe(false);
    expect(isBackpressureRejected(null)).toBe(false);
    expect(isBackpressureRejected('string')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// withBackpressure — happy path (under capacity)
// ---------------------------------------------------------------------------

describe('withBackpressure: under capacity', () => {
  it('executes fn and returns the inner result when slot <= maxConcurrent', async () => {
    mockIncr.mockResolvedValueOnce(1);
    const fn = vi.fn().mockResolvedValue({ ok: true, value: 42 });

    const result = await withBackpressure('ocr-process', 10, fn);

    expect(result).toEqual({ ok: true, value: 42 });
    expect(fn).toHaveBeenCalledOnce();
    expect(mockIncr).toHaveBeenCalledWith('qstash:backpressure:ocr-process');
  });

  it('always sets EXPIRE after INCR (TTL leak guard for crashed pods)', async () => {
    mockIncr.mockResolvedValueOnce(3);
    const fn = vi.fn().mockResolvedValue('ok');

    await withBackpressure('ocr-process', 10, fn);

    expect(mockExpire).toHaveBeenCalledWith('qstash:backpressure:ocr-process', 60);
  });

  it('releases the slot via DECR after fn resolves', async () => {
    mockIncr.mockResolvedValueOnce(1);
    const fn = vi.fn().mockResolvedValue('done');

    await withBackpressure('ocr-process', 10, fn);

    expect(mockDecr).toHaveBeenCalledWith('qstash:backpressure:ocr-process');
    expect(mockDecr).toHaveBeenCalledOnce();
  });

  it('passes through at exactly the capacity boundary (slot == maxConcurrent)', async () => {
    mockIncr.mockResolvedValueOnce(10);
    const fn = vi.fn().mockResolvedValue('boundary');

    const result = await withBackpressure('ocr-process', 10, fn);

    expect(result).toBe('boundary');
    expect(fn).toHaveBeenCalledOnce();
    // Single DECR — only the success-path cleanup, no rejection bounce.
    expect(mockDecr).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// withBackpressure — DECR on throw (no slot leak on inner error)
// ---------------------------------------------------------------------------

describe('withBackpressure: inner fn throws', () => {
  it('still DECRs the slot when fn rejects, and propagates the original error', async () => {
    mockIncr.mockResolvedValueOnce(2);
    const innerErr = new Error('downstream provider failed');
    const fn = vi.fn().mockRejectedValue(innerErr);

    await expect(withBackpressure('ocr-process', 10, fn)).rejects.toBe(innerErr);

    expect(mockDecr).toHaveBeenCalledWith('qstash:backpressure:ocr-process');
    expect(mockDecr).toHaveBeenCalledOnce();
  });

  it('does not swallow inner errors when DECR also fails on cleanup', async () => {
    mockIncr.mockResolvedValueOnce(2);
    mockDecr.mockRejectedValueOnce(new Error('redis down on cleanup'));
    const innerErr = new Error('inner failure');
    const fn = vi.fn().mockRejectedValue(innerErr);

    // The original inner error should still surface — cleanup-DECR error is
    // logged at warn but must not mask the actual failure.
    await expect(withBackpressure('ocr-process', 10, fn)).rejects.toBe(innerErr);
  });
});

// ---------------------------------------------------------------------------
// withBackpressure — slot exhaustion (over capacity)
// ---------------------------------------------------------------------------

describe('withBackpressure: over capacity', () => {
  it('throws BackpressureRejectedError when slot > maxConcurrent', async () => {
    mockIncr.mockResolvedValueOnce(11); // Cap is 10.
    const fn = vi.fn();

    await expect(withBackpressure('ocr-process', 10, fn)).rejects.toBeInstanceOf(
      BackpressureRejectedError,
    );

    expect(fn).not.toHaveBeenCalled();
  });

  it('attaches the routeKey to the rejection (so route 429 handler can log it)', async () => {
    mockIncr.mockResolvedValueOnce(4);
    const fn = vi.fn();

    await expect(withBackpressure('peppol-outbound', 3, fn)).rejects.toMatchObject({
      name: 'BackpressureRejectedError',
      routeKey: 'peppol-outbound',
      retryAfterSec: 5,
    });
  });

  it('DECRs the speculatively-claimed slot when rejecting (no phantom slot)', async () => {
    mockIncr.mockResolvedValueOnce(11);
    const fn = vi.fn();

    await withBackpressure('ocr-process', 10, fn).catch(() => {
      /* expected reject */
    });

    // Two writes to the slot key happen during a rejection:
    //   1. INCR (claim)
    //   2. DECR (release the over-cap claim)
    // Plus a separate INCR to the per-minute rejection counter (different key).
    expect(mockDecr).toHaveBeenCalledWith('qstash:backpressure:ocr-process');
    expect(mockDecr).toHaveBeenCalledOnce();
  });

  it('emits a `backpressure.rejected` metric with the route tag', async () => {
    mockIncr
      .mockResolvedValueOnce(11) // slot acquisition (over cap)
      .mockResolvedValueOnce(1); // rejection-counter INCR
    const fn = vi.fn();

    await withBackpressure('ocr-process', 10, fn).catch(() => {
      /* expected reject */
    });

    expect(mockMetricsIncrement).toHaveBeenCalledWith('backpressure.rejected', 1, {
      route: 'ocr-process',
    });
  });

  it('does not run fn when rejected', async () => {
    mockIncr.mockResolvedValueOnce(50); // Way over cap.
    const fn = vi.fn().mockResolvedValue('should never run');

    await expect(withBackpressure('exports-process', 5, fn)).rejects.toBeInstanceOf(
      BackpressureRejectedError,
    );
    expect(fn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// withBackpressure — per-route isolation
// ---------------------------------------------------------------------------

describe('withBackpressure: per-route isolation', () => {
  it('uses independent Redis keys per routeKey (no cross-route starvation)', async () => {
    mockIncr.mockResolvedValueOnce(5).mockResolvedValueOnce(2);

    await withBackpressure('ocr-process', 10, async () => 'a');
    await withBackpressure('peppol-outbound', 3, async () => 'b');

    expect(mockIncr).toHaveBeenNthCalledWith(1, 'qstash:backpressure:ocr-process');
    expect(mockIncr).toHaveBeenNthCalledWith(2, 'qstash:backpressure:peppol-outbound');
  });

  it('a saturated route does not affect calls to a different route', async () => {
    // Route A is over-cap; route B is healthy.
    mockIncr
      .mockResolvedValueOnce(11) // ocr-process slot (over cap)
      .mockResolvedValueOnce(1) // ocr rejection-counter INCR
      .mockResolvedValueOnce(2); // peppol-outbound slot (under cap)

    const fnA = vi.fn();
    const fnB = vi.fn().mockResolvedValue('peppol-ok');

    await withBackpressure('ocr-process', 10, fnA).catch(() => {
      /* expected */
    });
    const result = await withBackpressure('peppol-outbound', 3, fnB);

    expect(fnA).not.toHaveBeenCalled();
    expect(fnB).toHaveBeenCalledOnce();
    expect(result).toBe('peppol-ok');
  });
});

// ---------------------------------------------------------------------------
// withBackpressure — fail-OPEN on Redis errors
// ---------------------------------------------------------------------------

describe('withBackpressure: fail-OPEN on Redis errors', () => {
  it('passes the call through when INCR throws (Redis unreachable)', async () => {
    mockIncr.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const fn = vi.fn().mockResolvedValue('passthrough-result');

    const result = await withBackpressure('ocr-process', 10, fn);

    // Documented contract at qstash-backpressure.ts:158-161: failing closed
    // would amplify a cache outage into a QStash backlog. Don't break this.
    expect(result).toBe('passthrough-result');
    expect(fn).toHaveBeenCalledOnce();
    // Cleanup DECR is skipped because no slot was successfully claimed.
    expect(mockDecr).not.toHaveBeenCalled();
  });

  it('does not throw BackpressureRejectedError when Redis is unavailable', async () => {
    mockIncr.mockRejectedValueOnce(new Error('Redis timeout'));
    const fn = vi.fn().mockResolvedValue('still-served');

    await expect(withBackpressure('ocr-process', 10, fn)).resolves.toBe('still-served');
  });
});

// ---------------------------------------------------------------------------
// withBackpressure — fail-OPEN when Redis is not configured (dev / CI)
// ---------------------------------------------------------------------------

describe('withBackpressure: no Redis configured', () => {
  it('passes through when env vars are missing', async () => {
    // Re-mock validators to return empty env, then re-import to reset the
    // module-level `redis` singleton.
    vi.resetModules();
    vi.doMock('@contractor-ops/validators', () => ({
      getServerEnv: () => ({}),
    }));
    vi.doMock('@contractor-ops/logger', () => ({
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
    vi.doMock('@contractor-ops/logger/metrics', () => ({
      metrics: { increment: vi.fn() },
    }));
    vi.doMock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }));
    vi.doMock('@upstash/redis', () => {
      class MockRedis {
        incr = vi.fn();
        decr = vi.fn();
        expire = vi.fn();
        get = vi.fn();
      }
      return { Redis: MockRedis };
    });

    const { withBackpressure: withBackpressureNoRedis } = await import('../qstash-backpressure.js');
    const fn = vi.fn().mockResolvedValue('no-redis-passthrough');

    const result = await withBackpressureNoRedis('ocr-process', 10, fn);

    expect(result).toBe('no-redis-passthrough');
    expect(fn).toHaveBeenCalledOnce();

    // Restore default mocks for any subsequent tests in this file.
    vi.resetModules();
    vi.doUnmock('@contractor-ops/validators');
    vi.doUnmock('@contractor-ops/logger');
    vi.doUnmock('@contractor-ops/logger/metrics');
    vi.doUnmock('@sentry/nextjs');
    vi.doUnmock('@upstash/redis');
  });
});

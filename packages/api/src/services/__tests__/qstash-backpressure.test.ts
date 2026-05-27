/**
 * Unit tests for `qstash-backpressure` (S3-4 / F-SCALE-19).
 *
 * Covers the production-critical contracts of `withBackpressure`:
 *   - happy-path pass-through under capacity
 *   - rejection with `BackpressureRejectedError` at capacity
 *   - DECR on success, throw, and rejection paths (no slot leaks)
 *   - per-route counter isolation (different routeKeys are independent)
 *   - fail-OPEN on Redis errors (deliberate, see qstash-backpressure.ts)
 *   - Atomic slot acquisition via Lua EVAL: INCR + EXPIRE-on-n==1 in one round trip,
 *     so EXPIRE is NOT re-armed on every call (hot-route TTL leak fix).
 *
 * The Sentry escalation path in `onRejected` is exercised indirectly (it's an
 * internal observability detail) — the focus here is the request-path
 * invariants every consumer route depends on.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state — Redis client + Sentry capture
// ---------------------------------------------------------------------------
//
// `mockEval` simulates the production Lua script (INCR + EXPIRE-on-n==1)
// against an in-memory key->slot map. Tests can override the next slot count
// via `mockEval.mockResolvedValueOnce(n)` for scenarios that need a specific
// value (e.g. over-cap = 11). Otherwise the default implementation
// increments the in-memory counter and conditionally invokes `mockExpire` so
// EXPIRE-emission tests can still observe it.

const {
  evalState,
  mockEval,
  mockIncr,
  mockDecr,
  mockExpire,
  mockGet,
  mockCaptureMessage,
  mockMetricsIncrement,
} = vi.hoisted(() => {
  const counters = new Map<string, number>();

  const mockExpire = vi.fn().mockResolvedValue(1);

  const mockEval = vi
    .fn<(script: string, keys: string[], args: string[]) => Promise<number>>()
    .mockImplementation(async (_script, keys, args) => {
      const key = keys[0];
      if (!key) throw new Error('mockEval: missing key');
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      if (next === 1) {
        const ttlSec = Number(args[0] ?? 60);
        await mockExpire(key, ttlSec);
      }
      return next;
    });

  return {
    evalState: { counters },
    mockEval,
    mockIncr: vi.fn(),
    mockDecr: vi.fn().mockResolvedValue(0),
    mockExpire,
    mockGet: vi.fn().mockResolvedValue(null),
    mockCaptureMessage: vi.fn(),
    mockMetricsIncrement: vi.fn(),
  };
});

vi.mock('@upstash/redis', () => {
  class MockRedis {
    eval = mockEval;
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

vi.mock('@sentry/node', () => ({
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
} from '../qstash-backpressure';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset call history. Then restore the in-memory eval simulator so tests
  // that don't override `mockEval` still get the realistic INCR+EXPIRE-on-1
  // behaviour rather than `undefined`.
  evalState.counters.clear();
  mockEval.mockReset().mockImplementation(async (_script, keys, args) => {
    const key = keys[0];
    if (!key) throw new Error('mockEval: missing key');
    const next = (evalState.counters.get(key) ?? 0) + 1;
    evalState.counters.set(key, next);
    if (next === 1) {
      const ttlSec = Number(args[0] ?? 60);
      await mockExpire(key, ttlSec);
    }
    return next;
  });
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
    mockEval.mockResolvedValueOnce(1);
    const fn = vi.fn().mockResolvedValue({ ok: true, value: 42 });

    const result = await withBackpressure('ocr-process', 10, fn);

    expect(result).toEqual({ ok: true, value: 42 });
    expect(fn).toHaveBeenCalledOnce();
    expect(mockEval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCR', KEYS[1])"),
      ['qstash:backpressure:ocr-process'],
      ['60'],
    );
    // Raw INCR is NOT used for slot acquisition — that path was the bug.
    expect(mockIncr).not.toHaveBeenCalledWith('qstash:backpressure:ocr-process');
  });

  it('runs the atomic Lua script: INCR + conditional EXPIRE on n == 1', async () => {
    // Default in-memory simulator yields n == 1 for the first call, so
    // EXPIRE must fire exactly once via the script's conditional branch.
    const fn = vi.fn().mockResolvedValue('ok');

    await withBackpressure('ocr-process', 10, fn);

    expect(mockEval).toHaveBeenCalledOnce();
    const [scriptArg, keysArg, argsArg] = mockEval.mock.calls[0]!;
    expect(scriptArg).toContain("redis.call('INCR', KEYS[1])");
    expect(scriptArg).toContain('if n == 1 then');
    expect(scriptArg).toContain("redis.call('EXPIRE', KEYS[1], ARGV[1])");
    expect(keysArg).toEqual(['qstash:backpressure:ocr-process']);
    expect(argsArg).toEqual(['60']);

    // The script ran the EXPIRE branch on n == 1 (first acquisition).
    expect(mockExpire).toHaveBeenCalledOnce();
    expect(mockExpire).toHaveBeenCalledWith('qstash:backpressure:ocr-process', 60);
  });

  it('does NOT re-arm EXPIRE on subsequent acquisitions of the same key', async () => {
    // Regression guard for the hot-route TTL leak: the pre-fix code reset
    // EXPIRE on every successful INCR, so a continuously-busy route could
    // keep an orphan slot alive past the 60s safety window. The fix sets
    // EXPIRE only on the first INCR (n == 1).
    const fn = vi.fn().mockResolvedValue('ok');

    await withBackpressure('ocr-process', 10, fn);
    await withBackpressure('ocr-process', 10, fn);

    expect(mockEval).toHaveBeenCalledTimes(2);
    // Both EVALs targeted the same key with the same script + TTL arg.
    expect(mockEval).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("redis.call('INCR', KEYS[1])"),
      ['qstash:backpressure:ocr-process'],
      ['60'],
    );
    expect(mockEval).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("redis.call('INCR', KEYS[1])"),
      ['qstash:backpressure:ocr-process'],
      ['60'],
    );
    // EXPIRE only fired on the first acquisition (n == 1 branch).
    expect(mockExpire).toHaveBeenCalledOnce();
    expect(mockExpire).toHaveBeenCalledWith('qstash:backpressure:ocr-process', 60);
  });

  it('releases the slot via DECR after fn resolves', async () => {
    mockEval.mockResolvedValueOnce(1);
    const fn = vi.fn().mockResolvedValue('done');

    await withBackpressure('ocr-process', 10, fn);

    expect(mockDecr).toHaveBeenCalledWith('qstash:backpressure:ocr-process');
    expect(mockDecr).toHaveBeenCalledOnce();
  });

  it('passes through at exactly the capacity boundary (slot == maxConcurrent)', async () => {
    mockEval.mockResolvedValueOnce(10);
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
    mockEval.mockResolvedValueOnce(2);
    const innerErr = new Error('downstream provider failed');
    const fn = vi.fn().mockRejectedValue(innerErr);

    await expect(withBackpressure('ocr-process', 10, fn)).rejects.toBe(innerErr);

    expect(mockDecr).toHaveBeenCalledWith('qstash:backpressure:ocr-process');
    expect(mockDecr).toHaveBeenCalledOnce();
  });

  it('does not swallow inner errors when DECR also fails on cleanup', async () => {
    mockEval.mockResolvedValueOnce(2);
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
    mockEval.mockResolvedValueOnce(11); // Cap is 10.
    const fn = vi.fn();

    await expect(withBackpressure('ocr-process', 10, fn)).rejects.toBeInstanceOf(
      BackpressureRejectedError,
    );

    expect(fn).not.toHaveBeenCalled();
  });

  it('attaches the routeKey to the rejection (so route 429 handler can log it)', async () => {
    mockEval.mockResolvedValueOnce(4);
    const fn = vi.fn();

    await expect(withBackpressure('peppol-outbound', 3, fn)).rejects.toMatchObject({
      name: 'BackpressureRejectedError',
      routeKey: 'peppol-outbound',
      retryAfterSec: 5,
    });
  });

  it('DECRs the speculatively-claimed slot when rejecting (no phantom slot)', async () => {
    mockEval.mockResolvedValueOnce(11);
    const fn = vi.fn();

    await withBackpressure('ocr-process', 10, fn).catch(() => {
      /* expected reject */
    });

    // Two writes to the slot key happen during a rejection:
    //   1. EVAL (INCR + maybe EXPIRE) to claim
    //   2. DECR (release the over-cap claim)
    // Plus a separate INCR to the per-minute rejection counter (different key).
    expect(mockDecr).toHaveBeenCalledWith('qstash:backpressure:ocr-process');
    expect(mockDecr).toHaveBeenCalledOnce();
  });

  it('still sets a TTL on the rejection-counter key (Sentry-window leak guard)', async () => {
    // Slot acquisition uses the atomic Lua EVAL, but the rejection counter
    // (`qstash:backpressure:rej:<route>:<minute>`) still uses raw INCR +
    // EXPIRE inside `onRejected`. Make sure that EXPIRE assertion is
    // preserved so the per-minute counter can't leak.
    mockEval.mockResolvedValueOnce(11);
    mockIncr.mockResolvedValueOnce(1); // rejection-counter INCR
    const fn = vi.fn();

    await withBackpressure('ocr-process', 10, fn).catch(() => {
      /* expected reject */
    });

    // Counter key follows `qstash:backpressure:rej:<route>:<minuteEpoch>`.
    // (SENTRY_ALERT_WINDOW_MIN + 1) * 60 = 360s
    expect(mockExpire).toHaveBeenCalledWith(
      expect.stringMatching(/^qstash:backpressure:rej:ocr-process:\d+$/),
      360,
    );
  });

  it('emits a `backpressure.rejected` metric with the route tag', async () => {
    mockEval.mockResolvedValueOnce(11); // slot acquisition (over cap)
    mockIncr.mockResolvedValueOnce(1); // rejection-counter INCR
    const fn = vi.fn();

    await withBackpressure('ocr-process', 10, fn).catch(() => {
      /* expected reject */
    });

    expect(mockMetricsIncrement).toHaveBeenCalledWith('backpressure.rejected', 1, {
      route: 'ocr-process',
    });
  });

  it('does not run fn when rejected', async () => {
    mockEval.mockResolvedValueOnce(50); // Way over cap.
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
    mockEval.mockResolvedValueOnce(5).mockResolvedValueOnce(2);

    await withBackpressure('ocr-process', 10, async () => 'a');
    await withBackpressure('peppol-outbound', 3, async () => 'b');

    expect(mockEval).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      ['qstash:backpressure:ocr-process'],
      ['60'],
    );
    expect(mockEval).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      ['qstash:backpressure:peppol-outbound'],
      ['60'],
    );
  });

  it('a saturated route does not affect calls to a different route', async () => {
    // Route A is over-cap; route B is healthy.
    mockEval
      .mockResolvedValueOnce(11) // ocr-process slot (over cap)
      .mockResolvedValueOnce(2); // peppol-outbound slot (under cap)
    mockIncr.mockResolvedValueOnce(1); // ocr rejection-counter INCR

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
  it('passes the call through when EVAL throws (Redis unreachable)', async () => {
    mockEval.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const fn = vi.fn().mockResolvedValue('passthrough-result');

    const result = await withBackpressure('ocr-process', 10, fn);

    // Documented contract: failing closed would amplify a cache outage into
    // a QStash backlog. Don't break this.
    expect(result).toBe('passthrough-result');
    expect(fn).toHaveBeenCalledOnce();
    // Cleanup DECR is skipped because no slot was successfully claimed.
    expect(mockDecr).not.toHaveBeenCalled();
  });

  it('does not throw BackpressureRejectedError when Redis is unavailable', async () => {
    mockEval.mockRejectedValueOnce(new Error('Redis timeout'));
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
    vi.doMock('@sentry/node', () => ({ captureMessage: vi.fn() }));
    vi.doMock('@upstash/redis', () => {
      class MockRedis {
        eval = vi.fn();
        incr = vi.fn();
        decr = vi.fn();
        expire = vi.fn();
        get = vi.fn();
      }
      return { Redis: MockRedis };
    });

    const { withBackpressure: withBackpressureNoRedis } = await import('../qstash-backpressure');
    const fn = vi.fn().mockResolvedValue('no-redis-passthrough');

    const result = await withBackpressureNoRedis('ocr-process', 10, fn);

    expect(result).toBe('no-redis-passthrough');
    expect(fn).toHaveBeenCalledOnce();

    // Restore default mocks for any subsequent tests in this file.
    vi.resetModules();
    vi.doUnmock('@contractor-ops/validators');
    vi.doUnmock('@contractor-ops/logger');
    vi.doUnmock('@contractor-ops/logger/metrics');
    vi.doUnmock('@sentry/node');
    vi.doUnmock('@upstash/redis');
  });
});

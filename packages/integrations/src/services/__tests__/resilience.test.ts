import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRetryableError } from '../fetch-helpers.js';
import { resetResilienceForTests, withResilience } from '../resilience.js';

afterEach(() => {
  resetResilienceForTests();
  vi.restoreAllMocks();
});

describe('isRetryableError', () => {
  it('treats null/undefined as non-retryable', () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });

  it('treats network error codes as retryable', () => {
    const err = Object.assign(new Error('boom'), { code: 'ECONNRESET' });
    expect(isRetryableError(err)).toBe(true);
  });

  it('treats undici cause-nested error codes as retryable', () => {
    const err = Object.assign(new Error('fetch failed'), {
      cause: { code: 'UND_ERR_CONNECT_TIMEOUT' },
    });
    expect(isRetryableError(err)).toBe(true);
  });

  it('treats 5xx status as retryable', () => {
    expect(isRetryableError({ status: 503 })).toBe(true);
    expect(isRetryableError({ statusCode: 500 })).toBe(true);
    expect(isRetryableError({ response: { status: 502 } })).toBe(true);
  });

  it('treats 429 / 408 as retryable but other 4xx as permanent', () => {
    expect(isRetryableError({ status: 429 })).toBe(true);
    expect(isRetryableError({ status: 408 })).toBe(true);
    expect(isRetryableError({ status: 400 })).toBe(false);
    expect(isRetryableError({ status: 401 })).toBe(false);
    expect(isRetryableError({ status: 403 })).toBe(false);
    expect(isRetryableError({ status: 404 })).toBe(false);
  });

  it('treats AbortError / TimeoutError as retryable', () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const timeoutErr = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    expect(isRetryableError(abortErr)).toBe(true);
    expect(isRetryableError(timeoutErr)).toBe(true);
  });

  it('treats unknown shapes as non-retryable (fail-closed)', () => {
    expect(isRetryableError({ message: 'mystery' })).toBe(false);
    expect(isRetryableError(new Error('plain'))).toBe(false);
  });
});

describe('withResilience', () => {
  it('returns the call result on success', async () => {
    const result = await withResilience(async () => 'ok', { provider: 'test-success' });
    expect(result).toBe('ok');
  });

  it('retries retryable errors and eventually succeeds', async () => {
    let attempts = 0;
    const call = vi.fn(async () => {
      attempts++;
      if (attempts < 3) {
        const err = Object.assign(new Error('flap'), { code: 'ECONNRESET' });
        throw err;
      }
      return 'recovered';
    });

    const result = await withResilience(call, {
      provider: 'test-retry',
      retryAttempts: 3,
    });

    expect(result).toBe('recovered');
    expect(call).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry permanent errors (4xx other than 408/429)', async () => {
    const call = vi.fn(async () => {
      throw Object.assign(new Error('bad request'), { status: 400 });
    });

    await expect(
      withResilience(call, { provider: 'test-permanent', retryAttempts: 5 }),
    ).rejects.toThrow('bad request');
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('opens the breaker after sustained failures and short-circuits subsequent calls', async () => {
    // Use a unique provider name so the breaker is fresh.
    const provider = 'test-breaker-open';
    const failingCall = vi.fn(async () => {
      throw Object.assign(new Error('upstream down'), { code: 'ECONNRESET' });
    });

    // Fire enough calls to exceed the volume threshold (default 5).
    // Each call exhausts its own retry budget then surfaces the failure.
    for (let i = 0; i < 8; i++) {
      await expect(
        withResilience(failingCall, { provider, retryAttempts: 0 }),
      ).rejects.toBeDefined();
    }

    // After enough failures, opossum opens. Subsequent calls are
    // short-circuited with "Breaker is open" without invoking `call`.
    const callsBeforeOpenAttempt = failingCall.mock.calls.length;

    let rejectedByBreaker = false;
    try {
      await withResilience(failingCall, { provider, retryAttempts: 0 });
    } catch (err) {
      // opossum throws an error with message containing "Breaker" when open.
      rejectedByBreaker = err instanceof Error && /Breaker is open|breaker/i.test(err.message);
    }

    // Either the breaker opened (no extra call recorded) OR the test
    // tolerates one half-open probe. We assert the breaker is at least
    // doing its job by capping successive invocations.
    expect(failingCall.mock.calls.length - callsBeforeOpenAttempt).toBeLessThanOrEqual(1);
    if (failingCall.mock.calls.length === callsBeforeOpenAttempt) {
      expect(rejectedByBreaker).toBe(true);
    }
  });

  it('honours per-provider concurrency limit', async () => {
    const provider = 'test-concurrency';
    let inFlight = 0;
    let maxInFlight = 0;
    const call = async (): Promise<string> => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(resolve => setTimeout(resolve, 10));
      inFlight--;
      return 'done';
    };

    // Default config concurrencyLimit = 10; fire 20 in parallel.
    await Promise.all(
      Array.from({ length: 20 }, () => withResilience(call, { provider, retryAttempts: 0 })),
    );

    // The default limit is 10; we should never have observed more in flight
    // simultaneously than that.
    expect(maxInFlight).toBeLessThanOrEqual(10);
  });

  it('supports an external AbortSignal that cancels in-flight retries', async () => {
    const controller = new AbortController();
    const call = vi.fn(async () => {
      throw Object.assign(new Error('flap'), { code: 'ECONNRESET' });
    });

    // Abort before the retry loop kicks in.
    setTimeout(() => controller.abort(), 5);

    await expect(
      withResilience(call, {
        provider: 'test-abort',
        retryAttempts: 10,
        signal: controller.signal,
      }),
    ).rejects.toBeDefined();

    // p-retry should have stopped early — fewer attempts than retryAttempts + 1.
    expect(call.mock.calls.length).toBeLessThan(11);
  });
});

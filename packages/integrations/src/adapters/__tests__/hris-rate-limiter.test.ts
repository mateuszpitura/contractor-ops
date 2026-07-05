import { afterEach, describe, expect, it, vi } from 'vitest';

import { RateLimiter } from '../hris-rate-limiter.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('RateLimiter', () => {
  it('grants up to the budget immediately, then serializes the overflow at the drip rate', async () => {
    vi.useFakeTimers();
    const rl = new RateLimiter(2, 100); // 2 permits / 100ms → 1 every 50ms

    await rl.acquire();
    await rl.acquire();

    let third = false;
    const p = rl.acquire().then(() => {
      third = true;
    });
    // The third permit is not available yet.
    await Promise.resolve();
    expect(third).toBe(false);

    await vi.advanceTimersByTimeAsync(50);
    await p;
    expect(third).toBe(true);
  });

  it('caps a burst of N > budget so they resolve over time, not all at once', async () => {
    vi.useFakeTimers();
    const rl = new RateLimiter(3, 300); // 3 / 300ms → 1 / 100ms
    const order: number[] = [];
    const promises = Array.from({ length: 6 }, (_, i) => rl.acquire().then(() => order.push(i)));

    await Promise.resolve();
    // First 3 resolve immediately.
    expect(order.length).toBe(3);

    await vi.advanceTimersByTimeAsync(300);
    await Promise.all(promises);
    expect(order.length).toBe(6);
  });
});

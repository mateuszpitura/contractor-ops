/**
 * Per-subscription dispatch rate-limit security net
 * (`services/webhooks/rate-limit.ts`).
 *
 * A single subscription may dispatch at most 100 events/min. The 101st in a
 * minute is THROTTLED (the deliver drain requeues it with a short delay), never
 * dropped. The limiter fails OPEN on a backend outage so a Redis blip does not
 * silently swallow legitimate events. A different subscription is unaffected.
 */

import { describe, expect, it, vi } from 'vitest';

const RATE_LIMIT_MODULE = '../../services/webhooks/rate-limit';

describe('overDispatchRateLimit — per-sub 100/min throttle (INTEG-SEC-03)', () => {
  it('caps at 100 events per minute', async () => {
    const mod = (await import(RATE_LIMIT_MODULE)) as Record<string, unknown>;
    expect(mod.WEBHOOK_DISPATCH_RATE_LIMIT_PER_MIN).toBe(100);
  });

  it('permits the first 100 and throttles the 101st (requeue, not drop)', async () => {
    const { overDispatchRateLimit } = (await import(RATE_LIMIT_MODULE)) as {
      overDispatchRateLimit: (
        id: string,
        opts?: { incr?: (key: string) => Promise<number> },
      ) => Promise<boolean>;
    };
    let count = 0;
    const incr = vi.fn(async () => (count += 1));
    for (let i = 1; i <= 100; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      expect(await overDispatchRateLimit('whsub_1', { incr })).toBe(false);
    }
    expect(await overDispatchRateLimit('whsub_1', { incr })).toBe(true);
  });

  it('fails OPEN (not over-limit) when the counter backend errors', async () => {
    const { overDispatchRateLimit } = (await import(RATE_LIMIT_MODULE)) as {
      overDispatchRateLimit: (
        id: string,
        opts?: { incr?: (key: string) => Promise<number> },
      ) => Promise<boolean>;
    };
    const incr = vi.fn(async () => {
      throw new Error('redis down');
    });
    expect(await overDispatchRateLimit('whsub_1', { incr })).toBe(false);
  });
});

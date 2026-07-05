// In-process BoE base-rate cache: reuse within the TTL, refresh past it, and
// force-refresh on explicit invalidation. The TTL is the backstop that stops the
// API process serving a stale in-memory copy after the poller writes a new row.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetBoeRateCacheForTests,
  invalidateBoeRateCache,
  loadBoeRateHistory,
} from '../boe-rate-cache';

const CACHE_TTL_MS = 5 * 60 * 1000;

function makeDb(rows: Array<{ effectiveFrom: Date; ratePercent: number }>) {
  const findMany = vi.fn(async () => rows);
  return { db: { boEBaseRateHistory: { findMany } } as never, findMany };
}

const ROWS = [{ effectiveFrom: new Date(Date.UTC(2025, 10, 6)), ratePercent: 3.75 }];

describe('loadBoeRateHistory — TTL cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-05T00:00:00.000Z'));
    __resetBoeRateCacheForTests();
  });

  afterEach(() => {
    __resetBoeRateCacheForTests();
    vi.useRealTimers();
  });

  it('hits the DB on the first load and serves the cache within the TTL', async () => {
    const { db, findMany } = makeDb(ROWS);

    await loadBoeRateHistory(db);
    await loadBoeRateHistory(db);
    vi.advanceTimersByTime(CACHE_TTL_MS - 1);
    await loadBoeRateHistory(db);

    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('refreshes from the DB once the TTL has elapsed', async () => {
    const { db, findMany } = makeDb(ROWS);

    await loadBoeRateHistory(db);
    vi.advanceTimersByTime(CACHE_TTL_MS + 1);
    await loadBoeRateHistory(db);

    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('force-refreshes after invalidateBoeRateCache regardless of TTL', async () => {
    const { db, findMany } = makeDb(ROWS);

    await loadBoeRateHistory(db);
    invalidateBoeRateCache();
    await loadBoeRateHistory(db);

    expect(findMany).toHaveBeenCalledTimes(2);
  });
});

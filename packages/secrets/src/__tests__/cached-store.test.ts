import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CachedStore } from '../cached-store.js';
import type { SecretStore } from '../secret-store.js';

/** Creates a spy-backed {@link SecretStore} for verifying delegation. */
function createBackingSpy(initial?: Record<string, string>): SecretStore & {
  getCalls: number;
} {
  const data = new Map<string, string>(initial ? Object.entries(initial) : []);
  const spy: SecretStore & { getCalls: number } = {
    getCalls: 0,
    get: vi.fn(async (path: string) => {
      spy.getCalls++;
      return data.get(path) ?? null;
    }),
    set: vi.fn(async (path: string, value: string) => {
      data.set(path, value);
    }),
    delete: vi.fn(async (path: string) => {
      data.delete(path);
    }),
  };
  return spy;
}

describe('CachedStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // get — cache hit / miss
  // -----------------------------------------------------------------------

  it('returns value from backing store on first get (cache miss)', async () => {
    const backing = createBackingSpy({ 'org/key': 'secret' });
    const cached = new CachedStore(backing);

    expect(await cached.get('org/key')).toBe('secret');
    expect(backing.get).toHaveBeenCalledTimes(1);
  });

  it('serves from cache on second get without calling backing store', async () => {
    const backing = createBackingSpy({ 'org/key': 'secret' });
    const cached = new CachedStore(backing);

    await cached.get('org/key');
    await cached.get('org/key');

    expect(backing.get).toHaveBeenCalledTimes(1);
  });

  it('returns null when backing store has no value', async () => {
    const backing = createBackingSpy();
    const cached = new CachedStore(backing);

    expect(await cached.get('missing')).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Null values are NOT cached — re-query backing on subsequent miss
  // -----------------------------------------------------------------------

  it('does not cache null — re-queries backing for missing keys', async () => {
    const backing = createBackingSpy();
    const cached = new CachedStore(backing);

    await cached.get('missing');
    await cached.get('missing');

    expect(backing.get).toHaveBeenCalledTimes(2);
  });

  // -----------------------------------------------------------------------
  // TTL expiry
  // -----------------------------------------------------------------------

  it('serves cached value within TTL', async () => {
    const backing = createBackingSpy({ k: 'v' });
    const cached = new CachedStore(backing, { ttlMs: 1_000 });

    await cached.get('k');
    vi.advanceTimersByTime(999);
    await cached.get('k');

    expect(backing.get).toHaveBeenCalledTimes(1);
  });

  it('re-fetches from backing store after TTL expires', async () => {
    const backing = createBackingSpy({ k: 'v' });
    const cached = new CachedStore(backing, { ttlMs: 1_000 });

    await cached.get('k');
    vi.advanceTimersByTime(1_001);
    await cached.get('k');

    expect(backing.get).toHaveBeenCalledTimes(2);
  });

  it('uses default 5 minute TTL when no option provided', async () => {
    const backing = createBackingSpy({ k: 'v' });
    const cached = new CachedStore(backing);

    await cached.get('k');

    // Just under 5 minutes — still cached
    vi.advanceTimersByTime(5 * 60_000 - 1);
    await cached.get('k');
    expect(backing.get).toHaveBeenCalledTimes(1);

    // Past 5 minutes — expired
    vi.advanceTimersByTime(2);
    await cached.get('k');
    expect(backing.get).toHaveBeenCalledTimes(2);
  });

  // -----------------------------------------------------------------------
  // LRU eviction
  // -----------------------------------------------------------------------

  it('evicts oldest entry when maxEntries is exceeded', async () => {
    const initial: Record<string, string> = {};
    for (let i = 0; i < 4; i++) {
      initial[`key-${i}`] = `val-${i}`;
    }
    const backing = createBackingSpy(initial);
    const cached = new CachedStore(backing, { maxEntries: 3 });

    // Fill cache to capacity
    await cached.get('key-0');
    await cached.get('key-1');
    await cached.get('key-2');
    expect(backing.get).toHaveBeenCalledTimes(3);

    // This should evict key-0 (oldest)
    await cached.get('key-3');
    expect(backing.get).toHaveBeenCalledTimes(4);

    // key-0 was evicted, must re-fetch
    await cached.get('key-0');
    expect(backing.get).toHaveBeenCalledTimes(5);

    // key-1 should still be cached (was not the oldest after key-0 eviction)
    // Actually key-1 is now the oldest after key-0 was evicted and key-3 added,
    // but we haven't exceeded capacity again so it stays.
    await cached.get('key-1');
    // key-1 was evicted to make room for key-0 re-fetch (capacity = 3, had key-1, key-2, key-3 -> evict key-1 for key-0)
    expect(backing.get).toHaveBeenCalledTimes(6);
  });

  it('LRU reorders on access — recently read entries survive eviction', async () => {
    const initial: Record<string, string> = {
      a: '1',
      b: '2',
      c: '3',
      d: '4',
    };
    const backing = createBackingSpy(initial);
    const cached = new CachedStore(backing, { maxEntries: 3 });

    // Fill cache: a, b, c
    await cached.get('a');
    await cached.get('b');
    await cached.get('c');

    // Access 'a' again to move it to most-recently-used
    await cached.get('a'); // should be a cache hit
    expect(backing.get).toHaveBeenCalledTimes(3); // still 3, 'a' served from cache

    // Insert 'd' — should evict 'b' (oldest after 'a' was refreshed)
    await cached.get('d');
    expect(backing.get).toHaveBeenCalledTimes(4);

    // 'a' should still be cached
    await cached.get('a');
    expect(backing.get).toHaveBeenCalledTimes(4);

    // 'b' was evicted — must re-fetch
    await cached.get('b');
    expect(backing.get).toHaveBeenCalledTimes(5);
  });

  // -----------------------------------------------------------------------
  // set — write-through
  // -----------------------------------------------------------------------

  it('set writes to backing store', async () => {
    const backing = createBackingSpy();
    const cached = new CachedStore(backing);

    await cached.set('org/key', 'secret');
    expect(backing.set).toHaveBeenCalledWith('org/key', 'secret');
  });

  it('set populates cache so subsequent get does not call backing', async () => {
    const backing = createBackingSpy();
    const cached = new CachedStore(backing);

    await cached.set('org/key', 'secret');
    const value = await cached.get('org/key');

    expect(value).toBe('secret');
    expect(backing.get).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // delete
  // -----------------------------------------------------------------------

  it('delete removes from backing store', async () => {
    const backing = createBackingSpy({ 'org/key': 'secret' });
    const cached = new CachedStore(backing);

    await cached.delete('org/key');
    expect(backing.delete).toHaveBeenCalledWith('org/key');
  });

  it('delete evicts from cache so next get calls backing', async () => {
    const backing = createBackingSpy({ 'org/key': 'secret' });
    const cached = new CachedStore(backing);

    // Populate cache
    await cached.get('org/key');
    expect(backing.get).toHaveBeenCalledTimes(1);

    // Delete should evict from cache
    await cached.delete('org/key');

    // Next get should go to backing (which no longer has it)
    const value = await cached.get('org/key');
    expect(value).toBeNull();
    expect(backing.get).toHaveBeenCalledTimes(2);
  });
});

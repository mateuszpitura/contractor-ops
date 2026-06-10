import type { SecretStore } from './secret-store.js';

interface CacheEntry {
  value: string;
  expiresAt: number;
}

export interface CachedStoreOptions {
  /** Cache TTL in milliseconds. Default: 5 minutes. */
  ttlMs?: number;
  /** Maximum number of cached entries (LRU eviction). Default: 1000. */
  maxEntries?: number;
}

const DEFAULT_TTL_MS = 5 * 60_000; // 5 minutes
const DEFAULT_MAX_ENTRIES = 1_000;

/**
 * LRU-cached decorator around any {@link SecretStore}.
 *
 * - `get()` serves from cache when the entry exists and has not expired,
 *   otherwise fetches from the backing store and caches the result.
 * - `set()` is write-through: updates both backing store and cache.
 * - `delete()` evicts from cache and deletes from backing store.
 *
 * The cache is in-process only — secrets never traverse Redis or any
 * shared infrastructure, matching the current security posture.
 */
export class CachedStore implements SecretStore {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly backing: SecretStore;
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(backing: SecretStore, options?: CachedStoreOptions) {
    this.backing = backing;
    this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  async get(path: string): Promise<string | null> {
    const cached = this.cache.get(path);
    if (cached && cached.expiresAt > Date.now()) {
      // Move to end for LRU ordering
      this.cache.delete(path);
      this.cache.set(path, cached);
      return cached.value;
    }

    // Cache miss or expired — fetch from backing store
    const value = await this.backing.get(path);
    if (value === null) {
      // Evict stale entry if present
      this.cache.delete(path);
    } else {
      this.putCache(path, value);
    }
    return value;
  }

  async set(path: string, value: string): Promise<void> {
    await this.backing.set(path, value);
    this.putCache(path, value);
  }

  async delete(path: string): Promise<void> {
    this.cache.delete(path);
    await this.backing.delete(path);
  }

  private putCache(path: string, value: string): void {
    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    this.cache.set(path, { value, expiresAt: Date.now() + this.ttlMs });
  }
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CachedStore,
  getSecretStore,
  MemoryStore,
  resetSecretStore,
  setSecretStore,
} from '../index.js';
import type { SecretStore } from '../secret-store.js';

describe('singleton secret store', () => {
  beforeEach(() => {
    resetSecretStore();
    // Suppress the console.warn emitted by getSecretStore's fallback path
    vi.spyOn(globalThis.console, 'warn').mockImplementation(() => {
      /* suppress fallback warning */
    });
  });

  it('getSecretStore returns a CachedStore wrapping MemoryStore by default', () => {
    const store = getSecretStore();
    expect(store).toBeInstanceOf(CachedStore);
  });

  it('getSecretStore returns the same instance on multiple calls', () => {
    const a = getSecretStore();
    const b = getSecretStore();
    expect(a).toBe(b);
  });

  it('setSecretStore replaces the singleton', () => {
    const custom = new MemoryStore();
    setSecretStore(custom);
    expect(getSecretStore()).toBe(custom);
  });

  it('resetSecretStore reverts to default on next call', () => {
    const custom = new MemoryStore();
    setSecretStore(custom);
    resetSecretStore();

    const store = getSecretStore();
    expect(store).not.toBe(custom);
    expect(store).toBeInstanceOf(CachedStore);
  });

  it('default store is functional (set + get round-trip)', async () => {
    const store = getSecretStore();
    await store.set('org/test', 'value');
    expect(await store.get('org/test')).toBe('value');
  });

  it('setSecretStore accepts any SecretStore implementation', async () => {
    const mock: SecretStore = {
      get: vi.fn(async () => 'mocked'),
      set: vi.fn(async () => {
        /* no-op mock */
      }),
      delete: vi.fn(async () => {
        /* no-op mock */
      }),
    };

    setSecretStore(mock);
    expect(await getSecretStore().get('any')).toBe('mocked');
    expect(mock.get).toHaveBeenCalledWith('any');
  });
});

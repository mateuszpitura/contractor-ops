import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryStore } from '../memory-store.js';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  it('returns null for a key that was never set', async () => {
    expect(await store.get('nonexistent')).toBeNull();
  });

  it('stores and retrieves a value', async () => {
    await store.set('org/slack', '{"token":"xoxb-123"}');
    expect(await store.get('org/slack')).toBe('{"token":"xoxb-123"}');
  });

  it('overwrites an existing key', async () => {
    await store.set('org/slack', 'v1');
    await store.set('org/slack', 'v2');
    expect(await store.get('org/slack')).toBe('v2');
  });

  it('deletes an existing key', async () => {
    await store.set('org/slack', 'secret');
    await store.delete('org/slack');
    expect(await store.get('org/slack')).toBeNull();
  });

  it('delete is a no-op for a non-existent key', async () => {
    // Should not throw
    await expect(store.delete('nonexistent')).resolves.toBeUndefined();
  });

  it('isolates keys from each other', async () => {
    await store.set('key-a', 'alpha');
    await store.set('key-b', 'beta');

    expect(await store.get('key-a')).toBe('alpha');
    expect(await store.get('key-b')).toBe('beta');

    await store.delete('key-a');
    expect(await store.get('key-a')).toBeNull();
    expect(await store.get('key-b')).toBe('beta');
  });
});

import { describe, expect, it } from 'vitest';
import type { ExtendedSecretStore } from '../secret-store.js';
import { SecretStoreError } from '../secret-store.js';

describe('SecretStoreError', () => {
  it('sets name to SecretStoreError', () => {
    const err = new SecretStoreError('failed', 'get');
    expect(err.name).toBe('SecretStoreError');
  });

  it('stores the error message', () => {
    const err = new SecretStoreError('connection timeout', 'set');
    expect(err.message).toBe('connection timeout');
  });

  it('stores the operation', () => {
    const err = new SecretStoreError('not found', 'delete');
    expect(err.operation).toBe('delete');
  });

  it('stores the cause when provided', () => {
    const cause = new Error('underlying');
    const err = new SecretStoreError('wrapped', 'get', cause);
    expect(err.cause).toBe(cause);
  });

  it('leaves cause undefined when not provided', () => {
    const err = new SecretStoreError('simple', 'set');
    expect(err.cause).toBeUndefined();
  });

  it('is an instance of Error', () => {
    const err = new SecretStoreError('test', 'get');
    expect(err).toBeInstanceOf(Error);
  });

  it('is an instance of SecretStoreError', () => {
    const err = new SecretStoreError('test', 'listSecrets');
    expect(err).toBeInstanceOf(SecretStoreError);
  });

  it('operation is readonly', () => {
    const err = new SecretStoreError('test', 'get');
    // TypeScript prevents reassignment at compile time; verify the value is stable
    expect(err.operation).toBe('get');
  });
});

describe('ExtendedSecretStore interface', () => {
  it('can be implemented with all required methods', async () => {
    const store: ExtendedSecretStore = {
      get: async (_path: string) => 'secret-value',
      set: async (_path: string, _value: string) => {},
      delete: async (_path: string) => {},
      listSecrets: async (_prefix: string) => ['cert-1', 'cert-2'],
    };

    expect(await store.get('/org/cert')).toBe('secret-value');
    await expect(store.set('/org/cert', 'val')).resolves.toBeUndefined();
    await expect(store.delete('/org/cert')).resolves.toBeUndefined();
    expect(await store.listSecrets('/org/')).toEqual(['cert-1', 'cert-2']);
  });

  it('get returns null when secret is not found', async () => {
    const store: ExtendedSecretStore = {
      get: async () => null,
      set: async () => {},
      delete: async () => {},
      listSecrets: async () => [],
    };

    expect(await store.get('/missing')).toBeNull();
  });

  it('listSecrets returns empty array for no matches', async () => {
    const store: ExtendedSecretStore = {
      get: async () => null,
      set: async () => {},
      delete: async () => {},
      listSecrets: async () => [],
    };

    expect(await store.listSecrets('/empty/')).toEqual([]);
  });
});

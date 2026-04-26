export type { CachedStoreOptions } from './cached-store.js';
export { CachedStore } from './cached-store.js';
export { MemoryStore } from './memory-store.js';
export type { SecretStore } from './secret-store.js';

import { createLogger } from '@contractor-ops/logger';
import { CachedStore } from './cached-store.js';
import { MemoryStore } from './memory-store.js';
import type { SecretStore } from './secret-store.js';

const log = createLogger({ service: 'secrets' });

// ---------------------------------------------------------------------------
// Singleton secret store
// ---------------------------------------------------------------------------

// biome-ignore lint/style/useNamingConvention: underscore prefix indicates module-private singleton
let _instance: SecretStore | null = null;

/**
 * Returns the singleton {@link SecretStore} for the process.
 *
 * When an external provider (Infisical, Doppler, etc.) is configured via
 * environment variables, the factory wraps it in a {@link CachedStore}.
 * Otherwise falls back to an in-memory store (suitable for local dev / tests).
 */
export function getSecretStore(): SecretStore {
  if (_instance) return _instance;

  log.warn(
    {},
    'no external secret store configured — using in-memory store. credentials will be lost on process restart.',
  );
  _instance = new CachedStore(new MemoryStore());
  return _instance;
}

/**
 * Replace the singleton store (useful in tests).
 */
export function setSecretStore(store: SecretStore): void {
  _instance = store;
}

/**
 * Reset the singleton (useful in test teardown).
 */
export function resetSecretStore(): void {
  _instance = null;
}

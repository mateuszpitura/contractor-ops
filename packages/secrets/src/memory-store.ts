import type { SecretStore } from "./secret-store.js";

/**
 * In-memory secret store backed by a plain `Map`.
 *
 * Use for:
 * - Unit / integration tests (inject directly, no mocking infra needed)
 * - Local development when no external provider is configured
 *
 * Secrets are lost when the process restarts.
 */
export class MemoryStore implements SecretStore {
  private readonly store = new Map<string, string>();

  async get(path: string): Promise<string | null> {
    return this.store.get(path) ?? null;
  }

  async set(path: string, value: string): Promise<void> {
    this.store.set(path, value);
  }

  async delete(path: string): Promise<void> {
    this.store.delete(path);
  }
}

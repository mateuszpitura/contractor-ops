/**
 * Abstract interface for a secret store backend.
 *
 * Paths follow the convention `{orgId}/{providerSlug}` for integration
 * credentials (e.g. `org_clu123/slack`). Values are opaque strings —
 * callers are responsible for serialization (typically JSON).
 */
export interface SecretStore {
  /** Retrieve a secret by path. Returns `null` if not found. */
  get(path: string): Promise<string | null>;

  /** Store or overwrite a secret at the given path. */
  set(path: string, value: string): Promise<void>;

  /** Delete a secret. No-op if the path does not exist. */
  delete(path: string): Promise<void>;
}

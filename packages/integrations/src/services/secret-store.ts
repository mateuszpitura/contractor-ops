// ---------------------------------------------------------------------------
// SecretStore interface -- ZATCA-specific extension of the core SecretStore
// ---------------------------------------------------------------------------
// Re-exports the core SecretStore interface from @contractor-ops/secrets and
// adds a listSecrets method for ZATCA certificate management use cases.
// ---------------------------------------------------------------------------

export type { SecretStore } from '@contractor-ops/secrets';

/**
 * Extended secret store with listing capability.
 *
 * The core SecretStore (get/set/delete) covers most use cases. ZATCA
 * certificate management needs listSecrets to enumerate all certs for
 * an organization (e.g. rotation, compliance dashboard).
 */
export interface ExtendedSecretStore {
  /** Retrieve a secret by path. Returns `null` if not found. */
  get(path: string): Promise<string | null>;
  /** Store or overwrite a secret at the given path. */
  set(path: string, value: string): Promise<void>;
  /** Delete a secret. No-op if the path does not exist. */
  delete(path: string): Promise<void>;
  /** List all secret names under the given path prefix. */
  listSecrets(pathPrefix: string): Promise<string[]>;
}

/**
 * Error class for secret store operations.
 * Includes the operation that failed for debugging without exposing secret values.
 */
export class SecretStoreError extends Error {
  readonly operation: string;

  constructor(message: string, operation: string, cause?: unknown) {
    super(message);
    this.name = 'SecretStoreError';
    this.operation = operation;
    if (cause) this.cause = cause;
  }
}

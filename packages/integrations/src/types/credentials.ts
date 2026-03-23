/**
 * Represents the decrypted credential blob stored per integration connection.
 * Encrypted at rest using AES-256-GCM with per-provider keys.
 */
export interface CredentialBlob {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  /** ISO 8601 timestamp of when the access token expires */
  expiresAt?: string;
  /** Provider-specific extra fields */
  extra?: Record<string, unknown>;
}

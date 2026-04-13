import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { CredentialBlob } from '../types/credentials.js';

// ---------------------------------------------------------------------------
// AES-256-GCM Credential Encryption
// Per D-01/D-02: Per-provider encryption keys for credential blobs
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const _AUTH_TAG_LENGTH = 16;

/**
 * Retrieves the AES-256 encryption key for a specific provider.
 * Keys are stored as hex-encoded 32-byte values in environment variables
 * following the pattern: `${SLUG_UPPER}_ENCRYPTION_KEY`.
 *
 * @param providerSlug - The provider identifier (e.g., "slack", "jira")
 * @returns Buffer containing the 32-byte encryption key
 * @throws Error if the environment variable is not set
 */
export function getProviderEncryptionKey(providerSlug: string): Buffer {
  const envVar = `${providerSlug.toUpperCase()}_ENCRYPTION_KEY`;
  const key = process.env[envVar];
  if (!key) {
    throw new Error(
      `${envVar} environment variable is not set. ` +
        `Each integration provider requires its own encryption key.`,
    );
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypts a credential blob using AES-256-GCM with the provider's key.
 * Returns format: `iv:authTag:ciphertext` (all hex-encoded).
 *
 * @param blob - The credential data to encrypt
 * @param providerSlug - Provider identifier for key lookup
 * @returns Encrypted string in `iv:authTag:ciphertext` format
 */
export function encryptCredentials(blob: CredentialBlob, providerSlug: string): string {
  const key = getProviderEncryptionKey(providerSlug);
  const iv = randomBytes(IV_LENGTH);
  const plaintext = JSON.stringify(blob);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted credential string back into a CredentialBlob.
 * Expects the `iv:authTag:ciphertext` hex format produced by encryptCredentials.
 *
 * @param encrypted - The encrypted string to decrypt
 * @param providerSlug - Provider identifier for key lookup
 * @returns The decrypted credential blob
 * @throws Error if the format is invalid or decryption fails
 */
export function decryptCredentials(encrypted: string, providerSlug: string): CredentialBlob {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted credentials format. Expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, ciphertext] = parts as [string, string, string];
  const key = getProviderEncryptionKey(providerSlug);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted) as CredentialBlob;
}

// ---------------------------------------------------------------------------
// Async API — credentialsRef is the encrypted string stored on IntegrationConnection
// ---------------------------------------------------------------------------

export async function storeCredentials(
  blob: CredentialBlob,
  _organizationId: string,
  providerSlug: string,
): Promise<string> {
  return encryptCredentials(blob, providerSlug);
}

export async function getCredentials(
  credentialsRef: string,
  providerSlug: string,
): Promise<CredentialBlob> {
  return decryptCredentials(credentialsRef, providerSlug);
}

export async function deleteCredentials(
  _credentialsRef: string,
  _providerSlug: string,
): Promise<void> {
  // Inline AES blob: nothing external to delete
}

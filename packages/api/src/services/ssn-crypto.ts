import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getServerEnv } from '@contractor-ops/validators';

// ---------------------------------------------------------------------------
// AES-256-GCM Social Security Number Encryption
// Mirrors bank-account-crypto.ts, but keyed by a DEDICATED SSN_ENCRYPTION_KEY
// (separate from BANK_ACCOUNT_ENCRYPTION_KEY) so the two secrets have distinct
// blast radii — a compromise of one key never exposes the other data class
// (Phase 84 D-01). Never hand-roll; the IV/authTag/format here matches the
// audited bank-account precedent.
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const key = getServerEnv().SSN_ENCRYPTION_KEY;
  return Buffer.from(key, 'hex');
}

/**
 * Encrypts a Social Security Number using AES-256-GCM.
 * Returns format: `iv:authTag:ciphertext` (all hex-encoded).
 */
export function encryptSsn(ssn: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(ssn, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted SSN.
 * Expects the `iv:authTag:ciphertext` hex format produced by encryptSsn.
 */
export function decryptSsn(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted SSN format. Expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, ciphertext] = parts as [string, string, string];
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Derives the plain trailing-4 of an SSN for default masked display.
 * Strips all non-digit separators first, then takes the last four digits.
 * The full value is only ever exposed via the audit-logged reveal procedure
 * gated by `contractorPii:read`.
 */
export function maskSsnLast4(ssn: string): string {
  return ssn.replace(/\D/g, '').slice(-4);
}

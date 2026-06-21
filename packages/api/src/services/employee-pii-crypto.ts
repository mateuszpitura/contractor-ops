import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getServerEnv } from '@contractor-ops/validators';

// ---------------------------------------------------------------------------
// AES-256-GCM Employee national-ID encryption
// Field-agnostic — encrypts the non-SSN employee national IDs (PESEL, Iqama,
// Emirates ID) under a DEDICATED EMPLOYEE_PII_ENCRYPTION_KEY, separate from the
// SSN and bank keys so each data class has an independent blast radius: a
// compromise of one key never exposes the others. The US SSN column keeps using
// ssn-crypto.ts + SSN_ENCRYPTION_KEY unchanged. Never hand-roll; the
// IV/authTag/format here matches the audited ssn-crypto precedent.
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const key = getServerEnv().EMPLOYEE_PII_ENCRYPTION_KEY;
  return Buffer.from(key, 'hex');
}

/**
 * Encrypts an employee national-ID value using AES-256-GCM.
 * Returns format: `iv:authTag:ciphertext` (all hex-encoded).
 */
export function encryptPii(value: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted employee national-ID value.
 * Expects the `iv:authTag:ciphertext` hex format produced by encryptPii.
 */
export function decryptPii(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted PII format. Expected iv:authTag:ciphertext');
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
 * Derives the plain trailing-4 of a national-ID value for default masked
 * display. Strips all non-digit separators first, then takes the last four
 * digits. The full value is only ever exposed via the audit-logged reveal
 * procedure gated by `employeePii:read`.
 */
export function maskLast4(value: string): string {
  return value.replace(/\D/g, '').slice(-4);
}

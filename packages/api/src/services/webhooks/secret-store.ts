/**
 * At-rest encryption for the per-subscription webhook secret.
 *
 * Unlike an API key (one-way HMAC-hashed, never recovered), a webhook secret
 * must be RECOVERABLE — we re-sign every delivery with it — so it is encrypted
 * with AES-256-GCM under a dedicated key (`WEBHOOK_SECRET_ENCRYPTION_KEY`, its
 * own blast radius), matching the bank-account / SSN / employee-PII crypto idiom.
 * Format: `iv:authTag:ciphertext` (all hex). Encrypt on create/rotate (100-08);
 * decrypt at dispatch to sign.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { getServerEnv } from '@contractor-ops/validators';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = getServerEnv().WEBHOOK_SECRET_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      'WEBHOOK_SECRET_ENCRYPTION_KEY is not set — required to create or dispatch outbound webhooks.',
    );
  }
  return Buffer.from(key, 'hex');
}

/** Encrypt a plaintext webhook secret to `iv:authTag:ciphertext` (hex). */
export function encryptWebhookSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/** Decrypt an `iv:authTag:ciphertext` webhook secret back to plaintext. */
export function decryptWebhookSecret(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted webhook secret');
  }
  const [ivHex, authTagHex, ciphertext] = parts as [string, string, string];
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/** Recover the signing secret for a subscription row. */
export function getWebhookSecret(sub: { secretEncrypted: string }): string {
  return decryptWebhookSecret(sub.secretEncrypted);
}

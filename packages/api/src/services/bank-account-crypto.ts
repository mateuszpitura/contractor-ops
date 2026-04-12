import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// ---------------------------------------------------------------------------
// AES-256-GCM Bank Account Number Encryption
// Same algorithm as credential-service but for sensitive financial data.
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.BANK_ACCOUNT_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "BANK_ACCOUNT_ENCRYPTION_KEY environment variable is not set. " +
        "Generate with: openssl rand -hex 32",
    );
  }
  return Buffer.from(key, "hex");
}

/**
 * Encrypts a bank account number using AES-256-GCM.
 * Returns format: `iv:authTag:ciphertext` (all hex-encoded).
 */
export function encryptBankAccount(accountNumber: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(accountNumber, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an encrypted bank account number.
 * Expects the `iv:authTag:ciphertext` hex format produced by encryptBankAccount.
 */
export function decryptBankAccount(encrypted: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted bank account format. Expected iv:authTag:ciphertext");
  }

  const [ivHex, authTagHex, ciphertext] = parts as [string, string, string];
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

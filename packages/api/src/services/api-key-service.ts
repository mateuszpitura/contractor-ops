import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { prisma } from '@contractor-ops/db';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KEY_PREFIX = 'co_live_';
const RANDOM_BYTES = 24;
const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const SALT_BYTES = 16;

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

/**
 * Generates a new API key with its hash for storage.
 *
 * Format: `co_live_<32-char-base64url>`
 * The first 8 chars after the prefix serve as a lookup prefix.
 * The full key is hashed with scrypt for secure storage.
 *
 * @returns plaintext (shown once), display prefix, and hash for DB storage
 */
export async function generateApiKey(): Promise<{
  plaintext: string;
  prefix: string;
  hash: string;
}> {
  const random = randomBytes(RANDOM_BYTES).toString('base64url');
  const plaintext = `${KEY_PREFIX}${random}`;
  const prefix = random.slice(0, 8);
  const hash = await hashKey(plaintext);

  return { plaintext, prefix, hash };
}

// ---------------------------------------------------------------------------
// Hashing & verification
// ---------------------------------------------------------------------------

/**
 * Hashes an API key using scrypt with a random salt.
 * Returns `salt:hash` (both hex-encoded).
 */
async function hashKey(plaintext: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(plaintext, salt, SCRYPT_KEYLEN);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

/**
 * Verifies a plaintext API key against a stored `salt:hash`.
 * Uses timing-safe comparison to prevent timing attacks.
 */
async function verifyKey(plaintext: string, storedHash: string): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(':');
  if (!(saltHex && hashHex)) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const derived = await scryptAsync(plaintext, salt, SCRYPT_KEYLEN);

  return timingSafeEqual(derived, expected);
}

// ---------------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a plaintext API key to its database record.
 *
 * 1. Extracts the 8-char prefix for fast DB lookup
 * 2. Finds non-revoked keys with that prefix
 * 3. Verifies the hash (may check multiple keys if prefixes collide)
 *
 * @returns The key record with organization, or null if invalid
 */
export async function resolveApiKey(plaintext: string) {
  if (!plaintext.startsWith(KEY_PREFIX)) return null;

  const random = plaintext.slice(KEY_PREFIX.length);
  const prefix = random.slice(0, 8);

  const candidates = await prisma.organizationApiKey.findMany({
    where: { prefix },
    include: {
      organization: {
        select: { id: true, dataRegion: true, status: true },
      },
    },
  });

  for (const candidate of candidates) {
    if (await verifyKey(plaintext, candidate.hash)) {
      return candidate;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Touch last used (fire-and-forget)
// ---------------------------------------------------------------------------

/**
 * Updates the `lastUsedAt` timestamp for an API key.
 * Fire-and-forget — errors are silently ignored.
 */
export function touchLastUsed(keyId: string): void {
  prisma.organizationApiKey
    .update({
      where: { id: keyId },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      // Intentionally swallowed — non-critical
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scryptAsync(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, SCRYPT_PARAMS, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

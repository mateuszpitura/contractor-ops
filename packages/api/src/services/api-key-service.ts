import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@contractor-ops/db';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KEY_PREFIX = 'co_live_';
const RANDOM_BYTES = 32;
const PREFIX_LENGTH = 12;
/**
 * Server-side secret for HMAC key hashing. Generated once at startup.
 * API keys are high-entropy (256 bits) so HMAC-SHA256 is sufficient —
 * scrypt/bcrypt are only needed for low-entropy passwords.
 */
const HMAC_SECRET = process.env.API_KEY_HMAC_SECRET ?? '';
const MAX_PREFIX_CANDIDATES = 3;

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

/**
 * Generates a new API key with its hash for storage.
 *
 * Format: `co_live_<43-char-base64url>` (256 bits of entropy)
 * The first 12 chars after the prefix serve as a lookup prefix.
 * The full key is hashed with HMAC-SHA256 for secure storage.
 *
 * @returns plaintext (shown once), display prefix, and hash for DB storage
 */
export function generateApiKey(): {
  plaintext: string;
  prefix: string;
  hash: string;
} {
  const random = randomBytes(RANDOM_BYTES).toString('base64url');
  const plaintext = `${KEY_PREFIX}${random}`;
  const prefix = random.slice(0, PREFIX_LENGTH);
  const hash = hashKey(plaintext);

  return { plaintext, prefix, hash };
}

// ---------------------------------------------------------------------------
// Hashing & verification
// ---------------------------------------------------------------------------

/**
 * Hashes an API key using HMAC-SHA256.
 * Returns hex-encoded hash.
 *
 * HMAC-SHA256 is appropriate here because API keys have high entropy (256 bits).
 * Slow KDFs like scrypt/bcrypt are designed for low-entropy passwords and would
 * add ~100ms latency per request without security benefit.
 */
function hashKey(plaintext: string): string {
  return createHmac('sha256', HMAC_SECRET).update(plaintext).digest('hex');
}

/**
 * Verifies a plaintext API key against a stored HMAC hash.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function verifyKey(plaintext: string, storedHash: string): boolean {
  const computed = Buffer.from(hashKey(plaintext), 'hex');
  const expected = Buffer.from(storedHash, 'hex');

  if (computed.length !== expected.length) return false;
  return timingSafeEqual(computed, expected);
}

// ---------------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a plaintext API key to its database record.
 *
 * 1. Extracts the 12-char prefix for fast DB lookup
 * 2. Finds non-revoked, non-expired keys with that prefix (capped at MAX_PREFIX_CANDIDATES)
 * 3. Verifies the HMAC hash (timing-safe)
 *
 * Revocation and expiration are checked at the DB level to avoid wasting
 * compute on keys that are already known to be invalid.
 *
 * @returns The key record with organization, or null if invalid
 */
export function resolveApiKey(plaintext: string) {
  if (!plaintext.startsWith(KEY_PREFIX)) return null;

  const random = plaintext.slice(KEY_PREFIX.length);
  const prefix = random.slice(0, PREFIX_LENGTH);

  return resolveByPrefix(plaintext, prefix);
}

async function resolveByPrefix(plaintext: string, prefix: string) {
  const candidates = await prisma.organizationApiKey.findMany({
    where: {
      prefix,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    take: MAX_PREFIX_CANDIDATES,
    include: {
      organization: {
        select: { id: true, dataRegion: true, status: true },
      },
    },
  });

  for (const candidate of candidates) {
    if (verifyKey(plaintext, candidate.hash)) {
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
 * Fire-and-forget — errors are logged but don't fail the request.
 */
export function touchLastUsed(keyId: string): void {
  prisma.organizationApiKey
    .update({
      where: { id: keyId },
      data: { lastUsedAt: new Date() },
    })
    .catch(err => {
      console.error('[api-key] Failed to update lastUsedAt:', keyId, err);
    });
}

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';

const log = createLogger({ service: 'api-key-service' });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KEY_PREFIX = 'co_live_';
const RANDOM_BYTES = 32;
export const PREFIX_LENGTH = 12;
// 12-char base64url prefix → ~2.8e21 combinations.
// Birthday-bound collision after ~2^36 keys — capped at 3 for safety.
const MAX_PREFIX_CANDIDATES = 3;

/**
 * Returns the HMAC secret, throwing at first use if not configured.
 * Lazy init avoids module-load-order issues while guaranteeing the secret
 * is validated before any crypto operation.
 */
let hmacSecret: string | undefined;
function getHmacSecret(): string {
  if (!hmacSecret) {
    const secret = process.env.API_KEY_HMAC_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error(
        'API_KEY_HMAC_SECRET must be set (min 32 chars). Generate with: openssl rand -hex 32',
      );
    }
    hmacSecret = secret;
  }
  return hmacSecret;
}

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
  return createHmac('sha256', getHmacSecret()).update(plaintext).digest('hex');
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
 * Debounced: writes at most once per 5 minutes per key to avoid
 * write storms under high traffic. Fire-and-forget.
 */
const TOUCH_DEBOUNCE_MS = 5 * 60_000;
const lastTouchedAt = new Map<string, number>();

export function touchLastUsed(keyId: string): void {
  const now = Date.now();
  const last = lastTouchedAt.get(keyId) ?? 0;

  if (now - last < TOUCH_DEBOUNCE_MS) return;
  lastTouchedAt.set(keyId, now);

  prisma.organizationApiKey
    .update({
      where: { id: keyId },
      data: { lastUsedAt: new Date() },
    })
    .catch(err => {
      log.error({ err, keyId }, 'failed to update lastUsedAt');
    });
}

// Cleanup stale debounce entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [keyId, timestamp] of lastTouchedAt) {
    if (now - timestamp > TOUCH_DEBOUNCE_MS * 2) {
      lastTouchedAt.delete(keyId);
    }
  }
}, 10 * 60_000).unref();

// ---------------------------------------------------------------------------
// Source-IP log (fire-and-forget, debounced + pruned)
// ---------------------------------------------------------------------------

const IP_EVENT_DEBOUNCE_MS = 5 * 60_000;
const IP_EVENTS_KEEP_PER_KEY = 50;
const lastIpEventAt = new Map<string, number>();

/**
 * Append a bounded source-IP event for an authenticated API-key request.
 * Debounced per `key+ip` (one row per 5 min) and pruned to the most recent
 * {@link IP_EVENTS_KEEP_PER_KEY} rows per key, so the log stays a small rolling
 * window (feeds the Developer page + the leak alarm). Fire-and-forget: a logging
 * failure must never break the request.
 */
export function appendApiKeyIpEvent(
  keyId: string,
  organizationId: string,
  ipAddress: string | undefined,
  userAgent: string | undefined,
): void {
  if (!ipAddress) return;

  const now = Date.now();
  const debounceKey = `${keyId}:${ipAddress}`;
  const last = lastIpEventAt.get(debounceKey) ?? 0;
  if (now - last < IP_EVENT_DEBOUNCE_MS) return;
  lastIpEventAt.set(debounceKey, now);

  void (async () => {
    try {
      await prisma.apiKeyIpEvent.create({
        data: { apiKeyId: keyId, organizationId, ipAddress, userAgent: userAgent ?? null },
      });

      // Prune older rows beyond the retained window (keep the newest N).
      const stale = await prisma.apiKeyIpEvent.findMany({
        where: { apiKeyId: keyId },
        orderBy: { seenAt: 'desc' },
        skip: IP_EVENTS_KEEP_PER_KEY,
        select: { id: true },
      });
      if (stale.length > 0) {
        await prisma.apiKeyIpEvent.deleteMany({ where: { id: { in: stale.map(r => r.id) } } });
      }
    } catch (err) {
      log.error({ err, keyId }, 'failed to append ApiKeyIpEvent');
    }
  })();
}

// Cleanup stale ip-event debounce entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of lastIpEventAt) {
    if (now - timestamp > IP_EVENT_DEBOUNCE_MS * 2) {
      lastIpEventAt.delete(key);
    }
  }
}, 10 * 60_000).unref();

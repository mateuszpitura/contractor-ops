import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { markSandboxOrg } from '../lib/demo';

const log = createLogger({ service: 'api-key-service' });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type ApiKeyEnvironment = 'LIVE' | 'SANDBOX';

// The plaintext tag per environment. `co_test_` keys resolve ONLY to sandbox
// orgs and `co_live_` keys ONLY to production orgs (resolveByPrefix fails closed
// on any mismatch), so a sandbox key can never touch production data.
const KEY_PREFIX: Record<ApiKeyEnvironment, string> = {
  LIVE: 'co_live_',
  SANDBOX: 'co_test_',
};
const LIVE_PREFIX = KEY_PREFIX.LIVE;
const SANDBOX_PREFIX = KEY_PREFIX.SANDBOX;
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
 * Format: `co_live_<43-char-base64url>` (LIVE) or `co_test_<43-char-base64url>`
 * (SANDBOX) — 256 bits of entropy either way. The first 12 chars after the
 * prefix serve as a lookup prefix. The full key is hashed with HMAC-SHA256.
 *
 * @returns plaintext (shown once), display prefix, and hash for DB storage
 */
export function generateApiKey(opts?: { environment?: ApiKeyEnvironment }): {
  plaintext: string;
  prefix: string;
  hash: string;
} {
  const environment = opts?.environment ?? 'LIVE';
  const random = randomBytes(RANDOM_BYTES).toString('base64url');
  const plaintext = `${KEY_PREFIX[environment]}${random}`;
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
  const tag = plaintext.startsWith(SANDBOX_PREFIX)
    ? SANDBOX_PREFIX
    : plaintext.startsWith(LIVE_PREFIX)
      ? LIVE_PREFIX
      : null;
  if (!tag) return null;

  const random = plaintext.slice(tag.length);
  const prefix = random.slice(0, PREFIX_LENGTH);

  return resolveByPrefix(plaintext, prefix);
}

async function resolveByPrefix(plaintext: string, prefix: string) {
  const now = new Date();
  const candidates = await prisma.organizationApiKey.findMany({
    where: {
      prefix,
      revokedAt: null,
      AND: [
        // Not expired.
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        // Rotation grace: a superseded key resolves ONLY until graceExpiresAt,
        // then hard-stops. A never-superseded key always passes this clause.
        { OR: [{ supersededAt: null }, { graceExpiresAt: { gt: now } }] },
      ],
    },
    take: MAX_PREFIX_CANDIDATES,
    include: {
      organization: {
        select: { id: true, dataRegion: true, status: true, isSandbox: true },
      },
    },
  });

  for (const candidate of candidates) {
    if (!verifyKey(plaintext, candidate.hash)) continue;

    // Fail closed on any environment<->org mismatch: a SANDBOX key resolves ONLY
    // to an isSandbox org and a LIVE key ONLY to a non-sandbox org. This is the
    // load-bearing control that keeps a `co_test_` key off production data.
    const keyIsSandbox = candidate.environment === 'SANDBOX';
    if (keyIsSandbox !== (candidate.organization.isSandbox === true)) {
      log.warn(
        { keyId: candidate.id, environment: candidate.environment },
        'API key environment<->org sandbox mismatch — rejecting (fail closed)',
      );
      return null;
    }

    if (keyIsSandbox) markSandboxOrg(candidate.organizationId);

    return candidate;
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

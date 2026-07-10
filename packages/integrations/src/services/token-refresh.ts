import { prisma } from '@contractor-ops/db';
import { getAdapter } from '../registry.js';
import { decryptCredentials, encryptCredentials } from './credential-service.js';

// ---------------------------------------------------------------------------
// Token Refresh — proactive cron + lazy fallback
// Proactive refresh before expiry.
// Distributed lock using refreshLockedAt field to prevent race conditions.
// ---------------------------------------------------------------------------

/** Lock TTL: if a lock is older than this, it's considered stale and can be acquired. */
const LOCK_TTL_MS = 30_000; // 30 seconds

/** Lookahead window: refresh tokens that expire within this window. */
const REFRESH_LOOKAHEAD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Proactive refresh: find all connections expiring within REFRESH_LOOKAHEAD_MS
 * and refresh their tokens. Uses database-level optimistic locking via
 * refreshLockedAt to prevent race conditions across cron instances.
 *
 * Called by Vercel Cron every 15 minutes.
 */
export async function refreshExpiring(): Promise<{
  refreshed: number;
  failed: number;
  total: number;
}> {
  const cutoff = new Date(Date.now() + REFRESH_LOOKAHEAD_MS);
  const staleLock = new Date(Date.now() - LOCK_TTL_MS);

  const connections = await prisma.integrationConnection.findMany({
    where: {
      status: 'CONNECTED',
      tokenExpiresAt: { lte: cutoff },
      // Skip connections already locked by another refresh attempt
      OR: [{ refreshLockedAt: null }, { refreshLockedAt: { lte: staleLock } }],
    },
  });

  let refreshed = 0;
  let failed = 0;

  for (const conn of connections) {
    const providerSlug = conn.provider.toLowerCase();

    // Providers without a refreshToken handler self-mint their bearer on demand
    // (client-credentials, e.g. Personio) or authenticate with a non-expiring
    // key. They hold no stored refresh token to rotate, so proactive refresh
    // must skip them rather than fail them into REAUTH_REQUIRED.
    if (!getAdapter(providerSlug)?.refreshToken) continue;

    // Optimistic lock: set refreshLockedAt, skip if already locked
    const locked = await prisma.integrationConnection.updateMany({
      where: {
        id: conn.id,
        OR: [
          { refreshLockedAt: null },
          { refreshLockedAt: { lte: new Date(Date.now() - LOCK_TTL_MS) } },
        ],
      },
      data: { refreshLockedAt: new Date() },
    });

    // Another process holds the lock. Skip BEFORE the try/finally below so the
    // finally never releases a lock this iteration did not acquire.
    if (locked.count === 0) continue;

    try {
      await refreshSingleConnection(conn.id, providerSlug, conn.credentialsRef);
      refreshed++;
    } catch (error) {
      failed++;
      await markRefreshFailed(conn.id, error);
    } finally {
      // Release the lock this iteration acquired.
      await prisma.integrationConnection
        .update({
          where: { id: conn.id },
          data: { refreshLockedAt: null },
        })
        .catch(() => {
          /* ignored */
        }); // ignore if already cleaned up
    }
  }

  return { refreshed, failed, total: connections.length };
}

/**
 * Lazy refresh: called before an API call when token might be expired.
 * Safety net for when cron misses a refresh cycle.
 *
 * Uses the same atomic `updateMany` claim pattern as `refreshExpiring`
 * — a plain read-then-write check on `refreshLockedAt` would let two
 * concurrent callers each call `adapter.refreshToken` against the OAuth
 * provider, and most providers (Google, Atlassian, DocuSign) invalidate
 * the previous refresh token on use. The losing caller would then be
 * silently moved to `REAUTH_REQUIRED`.
 *
 * @param connectionId - The IntegrationConnection ID to check and refresh
 * @returns true if refresh was performed, false otherwise (not expired,
 *   already locked by another caller, or connection missing)
 */
export async function lazyRefresh(connectionId: string): Promise<boolean> {
  const conn = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });

  if (!conn?.tokenExpiresAt) return false;
  if (conn.tokenExpiresAt > new Date()) return false; // not expired yet

  // Atomic lock acquisition. updateMany returns count: 0 if another caller
  // already holds an active lock — in that case we yield, the other caller
  // will refresh, and the API request can retry.
  const staleCutoff = new Date(Date.now() - LOCK_TTL_MS);
  const claimed = await prisma.integrationConnection.updateMany({
    where: {
      id: connectionId,
      OR: [{ refreshLockedAt: null }, { refreshLockedAt: { lte: staleCutoff } }],
    },
    data: { refreshLockedAt: new Date() },
  });

  if (claimed.count === 0) return false; // another process owns the lock

  try {
    await refreshSingleConnection(connectionId, conn.provider.toLowerCase(), conn.credentialsRef);
    return true;
  } catch (error) {
    await markRefreshFailed(connectionId, error);
    return false;
  } finally {
    await prisma.integrationConnection
      .update({
        where: { id: connectionId },
        data: { refreshLockedAt: null },
      })
      .catch(() => {
        /* ignored */
      });
  }
}

/**
 * Refreshes a single connection's tokens via the provider adapter.
 * Decrypts existing credentials, calls adapter.refreshToken, re-encrypts,
 * and updates the connection record.
 */
async function refreshSingleConnection(
  connectionId: string,
  providerSlug: string,
  encryptedRef: string,
): Promise<void> {
  const adapter = getAdapter(providerSlug);
  if (!adapter?.refreshToken) {
    throw new Error(`No refresh handler for provider: ${providerSlug}`);
  }

  const credentials = decryptCredentials(encryptedRef, providerSlug);
  const newCredentials = await adapter.refreshToken(credentials);
  const encrypted = encryptCredentials(newCredentials, providerSlug);

  // Persist only the rotated credentials + expiry. Do NOT stamp lastSyncAt here:
  // the HRIS pull orchestrator reuses lastSyncAt as its hourly throttle, so a
  // token refresh would masquerade as a completed sync and suppress pulls
  // indefinitely. (No dedicated lastTokenRefreshAt column exists in the schema.)
  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: {
      credentialsRef: encrypted,
      tokenExpiresAt: newCredentials.expiresAt ? new Date(newCredentials.expiresAt) : null,
      refreshLockedAt: null,
    },
  });
}

/**
 * Marks a connection as requiring re-authentication after a failed refresh.
 */
async function markRefreshFailed(connectionId: string, error: unknown): Promise<void> {
  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: {
      status: 'REAUTH_REQUIRED',
      lastErrorAt: new Date(),
      lastErrorMessage: error instanceof Error ? error.message : 'Token refresh failed',
      refreshLockedAt: null,
    },
  });
}

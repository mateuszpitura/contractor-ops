import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@contractor-ops/db';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Portal sessions expire after 7 days (Decision D-14). */
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Token utilities
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random session token (base64url, 32 bytes).
 * The raw token is sent to the client; only the SHA-256 hash is stored.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hash a token with SHA-256 before storage or lookup.
 * Ensures stolen database contents cannot be used to impersonate sessions.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new portal session for a contractor.
 * Returns the raw (unhashed) token for the client cookie and the expiry date.
 */
export async function createPortalSession(opts: {
  contractorId: string;
  organizationId: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = generateSessionToken();
  const hashedToken = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.portalSession.create({
    data: {
      token: hashedToken,
      contractorId: opts.contractorId,
      organizationId: opts.organizationId,
      email: opts.email,
      expiresAt,
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ?? null,
    },
  });

  return { rawToken, expiresAt };
}

/**
 * Validate a portal session token.
 * Returns the session with contractor data if valid; null if expired or not found.
 */
export async function validatePortalSession(rawToken: string) {
  const hashedToken = hashToken(rawToken);

  const session = await prisma.portalSession.findUnique({
    where: { token: hashedToken },
    include: { contractor: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) return null;

  // Block access if the contractor has been archived or deactivated
  if (session.contractor.status === 'ARCHIVED' || session.contractor.status === 'INACTIVE') {
    return null;
  }

  return session;
}

/**
 * Delete a portal session (logout).
 * Uses deleteMany to avoid throwing if the session does not exist.
 */
export async function deletePortalSession(rawToken: string): Promise<void> {
  const hashedToken = hashToken(rawToken);
  await prisma.portalSession.deleteMany({
    where: { token: hashedToken },
  });
}

/**
 * Remove all expired portal sessions.
 * Intended for periodic cleanup (cron job or scheduled task).
 * Returns the number of sessions removed.
 */
export async function cleanExpiredSessions(): Promise<number> {
  const result = await prisma.portalSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

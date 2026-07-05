import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@contractor-ops/db';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Portal sessions expire after 7 days. */
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
 * Options for {@link createPortalSession}, discriminated by subject. Exactly one
 * subject id is written (the other stays null) so the row satisfies the DB
 * one-of CHECK: a CONTRACTOR session carries `contractorId`, an EMPLOYEE session
 * carries `workerId`.
 */
export type CreatePortalSessionOpts =
  | {
      subjectType: 'CONTRACTOR';
      contractorId: string;
      organizationId: string;
      email: string;
      ipAddress?: string;
      userAgent?: string;
    }
  | {
      subjectType: 'EMPLOYEE';
      workerId: string;
      organizationId: string;
      email: string;
      ipAddress?: string;
      userAgent?: string;
    };

/**
 * Create a new portal session for a contractor OR an employee subject.
 * Returns the raw (unhashed) token for the client cookie and the expiry date.
 */
export async function createPortalSession(
  opts: CreatePortalSessionOpts,
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = generateSessionToken();
  const hashedToken = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.portalSession.create({
    data: {
      token: hashedToken,
      subjectType: opts.subjectType,
      contractorId: opts.subjectType === 'CONTRACTOR' ? opts.contractorId : null,
      workerId: opts.subjectType === 'EMPLOYEE' ? opts.workerId : null,
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
 * Validate a portal session token and resolve its subject.
 *
 * Returns a DISCRIMINATED result: `subjectType:'CONTRACTOR'` carries the loaded
 * `contractor` (rejected when ARCHIVED/INACTIVE), `subjectType:'EMPLOYEE'` carries
 * the loaded `worker` + `employeeProfile` (rejected when the worker is soft-deleted
 * or the employee is TERMINATED). Returns null when the token is missing, expired,
 * or the subject fails its status gate. One `findUnique` loads both relations; the
 * stored `subjectType` selects the branch.
 */
export async function validatePortalSession(rawToken: string) {
  const hashedToken = hashToken(rawToken);

  const session = await prisma.portalSession.findUnique({
    where: { token: hashedToken },
    include: { contractor: true, worker: { include: { employeeProfile: true } } },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) return null;

  if (session.subjectType === 'EMPLOYEE') {
    const { worker } = session;
    // A soft-deleted worker or a TERMINATED employee can no longer authenticate.
    if (!worker || worker.deletedAt !== null) return null;
    const employeeProfile = worker.employeeProfile;
    if (employeeProfile?.employmentStatus === 'TERMINATED') return null;
    return { ...session, subjectType: 'EMPLOYEE' as const, worker, employeeProfile };
  }

  // CONTRACTOR subject. Block access if the contractor is archived or deactivated.
  const { contractor } = session;
  if (!contractor) return null;
  if (contractor.status === 'ARCHIVED' || contractor.status === 'INACTIVE') {
    return null;
  }

  return { ...session, subjectType: 'CONTRACTOR' as const, contractor };
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

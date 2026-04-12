/**
 * Consent record service — append-only consent tracking per PDPL requirements.
 *
 * Per D-02: ConsentRecord is immutable and append-only. Revocations create new
 * records with granted=false, never update existing ones. This provides a complete
 * audit trail of all consent changes.
 */

import { prisma } from "@contractor-ops/db";
import type { ConsentPurpose } from "@contractor-ops/validators";
import { REQUIRED_PURPOSES } from "@contractor-ops/validators";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConsentState {
  purpose: string;
  granted: boolean;
  version: number;
  lastUpdated: Date;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Grant consent for a specific purpose. Creates a new ConsentRecord
 * with granted=true. Version auto-increments.
 */
export async function grantConsent(
  organizationId: string,
  userId: string,
  purpose: ConsentPurpose,
  ipAddress?: string | null,
  userAgent?: string | null,
): Promise<{ id: string; version: number }> {
  const version = await getNextVersion(organizationId, userId, purpose);

  const record = await prisma.consentRecord.create({
    data: {
      organizationId,
      userId,
      purpose,
      granted: true,
      version,
      grantedAt: new Date(),
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    },
  });

  return { id: record.id, version: record.version };
}

/**
 * Revoke consent for a specific purpose. Creates a NEW ConsentRecord
 * with granted=false. Does NOT modify existing records (append-only per D-02).
 */
export async function revokeConsent(
  organizationId: string,
  userId: string,
  purpose: ConsentPurpose,
  ipAddress?: string | null,
  userAgent?: string | null,
): Promise<{ id: string; version: number }> {
  const version = await getNextVersion(organizationId, userId, purpose);

  const record = await prisma.consentRecord.create({
    data: {
      organizationId,
      userId,
      purpose,
      granted: false,
      version,
      revokedAt: new Date(),
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    },
  });

  return { id: record.id, version: record.version };
}

/**
 * Get current consent state for all purposes for a user.
 * Returns the latest record per purpose.
 */
export async function getCurrentConsent(
  organizationId: string,
  userId: string,
): Promise<Map<string, ConsentState>> {
  const records = await prisma.consentRecord.findMany({
    where: { organizationId, userId },
    orderBy: { createdAt: "desc" },
  });

  // Latest record per purpose
  const stateMap = new Map<string, ConsentState>();
  for (const record of records) {
    if (!stateMap.has(record.purpose)) {
      stateMap.set(record.purpose, {
        purpose: record.purpose,
        granted: record.granted,
        version: record.version,
        lastUpdated: record.createdAt,
      });
    }
  }

  return stateMap;
}

/**
 * Get consent history for a user, optionally filtered by purpose.
 * Returns all records ordered by createdAt DESC.
 */
export async function getConsentHistory(
  organizationId: string,
  userId: string,
  purpose?: ConsentPurpose,
): Promise<
  Array<{
    id: string;
    purpose: string;
    granted: boolean;
    version: number;
    grantedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }>
> {
  return prisma.consentRecord.findMany({
    where: {
      organizationId,
      userId,
      ...(purpose ? { purpose } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      purpose: true,
      granted: true,
      version: true,
      grantedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
}

/**
 * Check if user has granted all required consents.
 * Returns true only if every REQUIRED_PURPOSE has a latest record with granted=true.
 */
export async function hasRequiredConsents(
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const currentConsent = await getCurrentConsent(organizationId, userId);

  for (const purpose of REQUIRED_PURPOSES) {
    const state = currentConsent.get(purpose);
    if (!state || !state.granted) {
      return false;
    }
  }

  return true;
}

/**
 * Bulk grant/revoke consents in a single transaction.
 * Used during onboarding to accept multiple purposes at once.
 */
export async function bulkGrantConsent(
  organizationId: string,
  userId: string,
  consents: Array<{ purpose: ConsentPurpose; granted: boolean }>,
  ipAddress?: string | null,
  userAgent?: string | null,
): Promise<Array<{ id: string; purpose: string; granted: boolean; version: number }>> {
  return prisma.$transaction(async (tx) => {
    const results: Array<{
      id: string;
      purpose: string;
      granted: boolean;
      version: number;
    }> = [];

    for (const consent of consents) {
      const version = await getNextVersionTx(tx, organizationId, userId, consent.purpose);

      const record = await tx.consentRecord.create({
        data: {
          organizationId,
          userId,
          purpose: consent.purpose,
          granted: consent.granted,
          version,
          grantedAt: consent.granted ? new Date() : null,
          revokedAt: consent.granted ? null : new Date(),
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      });

      results.push({
        id: record.id,
        purpose: record.purpose,
        granted: record.granted,
        version: record.version,
      });
    }

    return results;
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getNextVersion(
  organizationId: string,
  userId: string,
  purpose: ConsentPurpose,
): Promise<number> {
  const count = await prisma.consentRecord.count({
    where: { organizationId, userId, purpose },
  });
  return count + 1;
}

async function getNextVersionTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  organizationId: string,
  userId: string,
  purpose: ConsentPurpose,
): Promise<number> {
  const count = await tx.consentRecord.count({
    where: { organizationId, userId, purpose },
  });
  return count + 1;
}

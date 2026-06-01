import type { PrismaClient } from '@contractor-ops/db';
import type { ProvenanceLookupInput, ProvenanceMatchResult } from './types.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Phase 76 D-09/D-10 — Look up a provenance row matching (provider, externalUserId,
 * actionKind) within the last 1 hour. On hit, atomically claim it (set matchedAt = now).
 *
 * Returns:
 *   - { id } when a row matched and we won the atomic claim
 *   - null when no row matched, OR we lost the claim race (concurrent webhook claimed first)
 *
 * Concurrent-call safety (T-76-04-03): of N concurrent calls for the same row, only one
 * wins the `updateMany({ where: { id, matchedAt: null } })`. The loser gets count === 0 and
 * returns null → falls through to the default v3.0 user-departed path (D-11). Mirrors the
 * v5 claimDraft atomic-update pattern.
 */
export async function provenanceLookup(
  db: PrismaClient,
  input: ProvenanceLookupInput,
  now: Date = new Date(),
): Promise<ProvenanceMatchResult | null> {
  const cutoff = new Date(now.getTime() - ONE_HOUR_MS);

  const candidate = await db.idpChangeProvenance.findFirst({
    where: {
      provider: input.provider,
      externalUserId: input.externalUserId,
      actionKind: input.actionKind,
      matchedAt: null,
      initiatedAt: { gte: cutoff },
    },
    orderBy: { initiatedAt: 'desc' },
    select: { id: true },
  });

  if (!candidate) return null;

  // Atomic claim: only the first call to UPDATE this row succeeds.
  const claim = await db.idpChangeProvenance.updateMany({
    where: { id: candidate.id, matchedAt: null },
    data: { matchedAt: new Date() },
  });

  return claim.count > 0 ? { id: candidate.id } : null;
}

/**
 * Phase 76 D-09 — Insert a provenance row BEFORE the QStash deprovision job calls the
 * adapter method. Called from the step-runner (Plan 76-06). initiatedAt defaults to now()
 * and matchedAt is null (set later by the webhook handler on a match).
 */
export async function insertProvenance(
  db: PrismaClient,
  input: ProvenanceLookupInput & { deprovisioningStepId: string },
): Promise<{ id: string }> {
  return db.idpChangeProvenance.create({
    data: {
      organizationId: input.organizationId,
      provider: input.provider,
      externalUserId: input.externalUserId,
      actionKind: input.actionKind,
      deprovisioningStepId: input.deprovisioningStepId,
    },
    select: { id: true },
  });
}

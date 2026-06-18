// Cross-jurisdiction mismatch evaluator.
// Determines whether the cited clauses' jurisdictions agree with the
// contract's declared jurisdiction. UK boilerplate in a DE contract triggers
// MANUAL_REVIEW_REQUIRED with a structured flag.

import { mapIsoToJurisdiction } from '@contractor-ops/compliance-policy';
import type { PrismaClient } from '@contractor-ops/db';
import type { Jurisdiction } from '@contractor-ops/validators';

export { mapIsoToJurisdiction };

/**
 * Resolves a contract's effective jurisdiction with the RESEARCH §3 fallback chain:
 *   1. Contract.jurisdiction      (3-char ISO, if non-null)
 *   2. Contractor.countryCode     (2-char ISO, if Contract.jurisdiction is null)
 *   3. Organization.countryCode   (2-char ISO, if both above are null)
 *
 * Returns null if no jurisdiction can be resolved (caller must handle —
 * verdict becomes MANUAL_REVIEW_REQUIRED with reason "no jurisdiction").
 */
export async function resolveContractJurisdiction(
  db: PrismaClient,
  contractId: string,
): Promise<Jurisdiction | null> {
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    select: {
      jurisdiction: true,
      contractor: { select: { countryCode: true } },
      organization: { select: { countryCode: true } },
    },
  });
  if (!contract) return null;
  const raw =
    contract.jurisdiction ??
    contract.contractor?.countryCode ??
    contract.organization?.countryCode ??
    null;
  if (!raw) return null;
  return mapIsoToJurisdiction(raw);
}

export interface CrossJurisdictionAnalysis {
  /** True if at least one cited clause's jurisdiction differs from the expected. */
  mismatch: boolean;
  /** The expected jurisdiction (from contract) — null if unresolved. */
  expectedJurisdiction: Jurisdiction | null;
  /** The set of jurisdictions cited in the clauses. */
  foundJurisdictions: Jurisdiction[];
}

export function analyzeCrossJurisdiction(
  expectedJurisdiction: Jurisdiction | null,
  citedClauseJurisdictions: readonly Jurisdiction[],
): CrossJurisdictionAnalysis {
  const found = Array.from(new Set(citedClauseJurisdictions));
  if (!expectedJurisdiction) {
    // No expected jurisdiction — every cited clause is foreign by definition;
    // caller treats as MANUAL_REVIEW_REQUIRED.
    return { mismatch: true, expectedJurisdiction: null, foundJurisdictions: found };
  }
  // Mismatch if at least one cited clause is from a DIFFERENT jurisdiction
  // (e.g., DE contract citing only UK phrases).
  const mismatch = found.length > 0 && !found.includes(expectedJurisdiction);
  return { mismatch, expectedJurisdiction, foundJurisdictions: found };
}

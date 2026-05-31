import type { ProvenanceLookupInput, ProvenanceMatchResult } from './types';

/**
 * D-09/D-10 — Provenance lookup + atomic match-claim. Stubbed in Plan 76-01;
 * implemented in Plan 76-04. Takes a `db` parameter (Prisma client) at call site.
 */
export async function provenanceLookup(
  _db: unknown,
  _input: ProvenanceLookupInput,
): Promise<ProvenanceMatchResult | null> {
  throw new Error('Not implemented — Phase 76 Plan 76-04');
}

export async function insertProvenance(
  _db: unknown,
  _input: ProvenanceLookupInput & { deprovisioningStepId: string },
): Promise<{ id: string }> {
  throw new Error('Not implemented — Phase 76 Plan 76-04');
}

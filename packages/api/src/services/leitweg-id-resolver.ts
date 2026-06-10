// packages/api/src/services/leitweg-id-resolver.ts
//
// Resolve the effective Leitweg-ID for an invoice using a two-tier cascade:
//
//   1. If the invoice has a `contractId` AND a LeitwegId row exists for that
//      contract → return it tagged as `contract_override`.
//   2. Else if the invoice has a `contractorId` AND a LeitwegId row exists
//      for that contractor with `isDefaultForContractor = true` → return it
//      tagged as `contractor_default`.
//   3. Else → return `null`. Callers treat this as a soft-gate: the XRechnung
//      XML can still be generated without BT-10 for non-Leitweg-mandated
//      buyers, while the UI flags the invoice red.
//
// Invariants:
// - Every query is scoped by `organizationId`. Cross-tenant leakage is
//   impossible at this layer regardless of the caller's Prisma extension state.
// - Two short, tier-specific queries (never a single OR) so each DB plan is
//   trivially readable and each short-circuits as soon as the upstream tier hits.
// - Contract-tier lookup is SKIPPED when `contractId` is null/undefined —
//   querying with `{ contractId: null }` would silently match rows with a
//   null contractId (e.g. a contractor-only default row), producing the
//   wrong resolution. The tests guard against this regression.

import type { PrismaClient } from '@contractor-ops/db/generated/prisma/client';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LeitwegIdSource = 'contract_override' | 'contractor_default';

export interface ResolvedLeitwegId {
  /** Raw Leitweg-ID string as stored (already validated at the tRPC boundary). */
  value: string;
  /** Which resolution tier produced the hit — surfaced on the finalize response for auditing. */
  source: LeitwegIdSource;
  /** Underlying LeitwegId row id — useful for downstream audit-log correlation. */
  leitwegIdRowId: string;
}

export interface ResolveLeitwegIdInput {
  contractId?: string | null;
  contractorId?: string | null;
}

// Minimal shape the resolver needs; the full `PrismaClient` extends it.
type LeitwegIdReader = {
  leitwegId: {
    findFirst: (args: {
      where: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => Promise<{ id: string; value: string } | null>;
  };
};

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the effective Leitweg-ID for an invoice using the two-tier cascade
 * described in the module header.
 *
 * Pure helper — callers supply the tenant-scoped Prisma client. Returns
 * `null` when no ID matches (the finalize mutation turns that into a
 * warning, not a hard error).
 */
export async function resolveLeitwegIdForInvoice(
  db: PrismaClient | LeitwegIdReader,
  organizationId: string,
  input: ResolveLeitwegIdInput,
): Promise<ResolvedLeitwegId | null> {
  const { contractId, contractorId } = input;

  // Tier 1 — contract-scoped override. Skip entirely when the
  // caller did not supply a contractId: Prisma would happily match rows with
  // `contractId = null` (i.e. contractor-default rows), which is the wrong
  // resolution.
  if (contractId) {
    const contractRow = await db.leitwegId.findFirst({
      where: { organizationId, contractId },
      select: { id: true, value: true },
    });
    if (contractRow) {
      return {
        value: contractRow.value,
        source: 'contract_override',
        leitwegIdRowId: contractRow.id,
      };
    }
  }

  // Tier 2 — contractor default. Must filter explicitly by
  // `isDefaultForContractor: true` so a non-default contractor-scoped row is
  // NEVER promoted.
  if (contractorId) {
    const contractorRow = await db.leitwegId.findFirst({
      where: {
        organizationId,
        contractorId,
        isDefaultForContractor: true,
      },
      select: { id: true, value: true },
    });
    if (contractorRow) {
      return {
        value: contractorRow.value,
        source: 'contractor_default',
        leitwegIdRowId: contractorRow.id,
      };
    }
  }

  // Tier 3 — no match → soft-gate.
  return null;
}

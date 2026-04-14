// packages/api/src/services/invoice-intake-matcher.ts
//
// Phase 62 · Plan 62-04 Task 1 — Contractor matcher for inbound e-invoice
// intake requests.
//
// Given the supplier signals extracted from a parsed XRechnung / ZUGFeRD
// document (VAT-ID, Leitweg-ID, normalised name), deterministically ranks the
// organization's existing Contractor rows and returns the top 5 candidates.
//
// The matcher is a *pure* service: the caller supplies a tenant-scoped
// PrismaClient. It never mutates rows, never logs raw supplier names (PII
// risk), and never widens its queries across organizations.
//
// Strategy (highest score first; multiple strategies sum into one row):
//
//   1. VAT-ID exact (case-insensitive)                              → 100
//   2. Leitweg-ID exact on any linked contractor                    →  90
//   3. Normalised-name exact match                                  →  70
//   4. Normalised-name Levenshtein ≤3 (first-3-char prefix gate)    → 50 - 5·d
//
// "Normalised name" lowercases, collapses whitespace, and strips common
// German/UK/US corporate-form suffixes ("GmbH", "AG", "Ltd", "Inc", "KG",
// "OHG", "GbR", "e.V.", "UG", "SE") so that "Alpha GmbH" and "Alpha AG"
// collide on their root — both then score 70 and neither unfairly outranks
// the other.
//
// The fuzzy sweep is gated by a first-three-character prefix match so we do
// not run an O(N) Levenshtein pass against every contractor in the org. Any
// row whose normalised name does not share the first three characters of the
// extracted name is skipped outright.
//
// Threats mitigated:
//   - T-62-04-M1 (cross-tenant candidate leak): every query filters by
//     organizationId, and the caller's PrismaClient is assumed to be tenant-
//     scoped via the existing extension. No OR condition widens scope.
//   - T-62-04-M2 (PII leakage via logs): we log `orgId` and (optionally) the
//     supplier VAT-ID because it is a business identifier, not personal
//     data. We NEVER log the supplier name or extracted normalised name.

import { logger } from '@contractor-ops/logger';

import type { PrismaClient } from '@contractor-ops/db';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MatchReason = 'VAT_ID' | 'LEITWEG_ID' | 'EXACT_NAME' | 'FUZZY_NAME';

export interface MatchCandidate {
  contractorId: string;
  displayName: string;
  vatIdentifier: string | null;
  /** Higher is better. Matches across strategies sum into a single score. */
  score: number;
  reasons: ReadonlyArray<{ reason: MatchReason; detail?: string }>;
}

export interface ExtractedSupplier {
  supplierVatId?: string | null;
  supplierLeitwegId?: string | null;
  supplierName: string;
}

const log = logger.child({ module: 'invoice-intake-matcher' });

// ---------------------------------------------------------------------------
// Scoring constants (exported for test assertions)
// ---------------------------------------------------------------------------

export const SCORE_VAT_ID = 100;
export const SCORE_LEITWEG_ID = 90;
export const SCORE_EXACT_NAME = 70;
export const SCORE_FUZZY_BASE = 50;
export const FUZZY_MAX_DISTANCE = 3;
export const MAX_CANDIDATES = 5;

// ---------------------------------------------------------------------------
// Name normalisation + Levenshtein
// ---------------------------------------------------------------------------

// Common corporate-form suffixes stripped during normalisation. Uses a
// non-capturing word-boundary group so "Alpha GmbH" becomes "alpha".
const CORP_FORM_RE =
  /\b(GmbH|UG|AG|Ltd\.?|Limited|Inc\.?|KG|OHG|GbR|e\.V\.|SE)\b/gi;

/**
 * Lowercase, collapse inner whitespace, strip common corporate-form suffixes,
 * and trim. Idempotent and deterministic for stable fuzzy comparison.
 */
export function normaliseContractorName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(CORP_FORM_RE, '')
    // Drop trailing punctuation left behind when a corporate-form token with
    // an optional period was stripped (e.g. "Ltd." loses "Ltd" via \b match,
    // leaving a stray "."). Also strips stray commas.
    .replace(/[.,]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Classic Wagner–Fischer Levenshtein distance. Allocates a single (m+1)
 * integer buffer plus a `prev` scalar — no dependency, no recursion.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Row of the DP table — we keep only the previous row.
  const row: number[] = new Array(m + 1);
  for (let i = 0; i <= m; i += 1) row[i] = i;

  for (let j = 1; j <= n; j += 1) {
    let prev = row[0] as number;
    row[0] = j;
    for (let i = 1; i <= m; i += 1) {
      const tmp = row[i] as number;
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      row[i] = Math.min(
        (row[i] as number) + 1, // deletion
        (row[i - 1] as number) + 1, // insertion
        prev + cost, // substitution
      );
      prev = tmp;
    }
  }
  return row[m] as number;
}

// ---------------------------------------------------------------------------
// Minimal Prisma surface the matcher needs. The real `PrismaClient` extends
// this; unit tests supply `vi.fn()` stubs conforming to the same shape.
// ---------------------------------------------------------------------------

interface ContractorRow {
  id: string;
  legalName: string;
  displayName: string;
  vatId: string | null;
}

interface LeitwegIdHit {
  contractorId: string | null;
  contractor: ContractorRow | null;
}

interface MatcherReader {
  contractor: {
    findFirst: (args: {
      where: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => Promise<ContractorRow | null>;
    findMany: (args: {
      where: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) => Promise<ContractorRow[]>;
  };
  leitwegId: {
    findMany: (args: {
      where: Record<string, unknown>;
      include?: Record<string, boolean>;
    }) => Promise<LeitwegIdHit[]>;
  };
}

type MatcherDb = PrismaClient | MatcherReader;

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

/**
 * Rank existing Contractor rows against the supplier signals extracted from
 * a parsed inbound e-invoice. Returns up to `MAX_CANDIDATES` candidates,
 * sorted by descending aggregated score.
 *
 * The caller's `db` must already be tenant-scoped. `orgId` is passed
 * explicitly so we can enforce the filter defensively even if the extension
 * is misconfigured.
 */
export async function rankIntakeCandidates(
  db: MatcherDb,
  orgId: string,
  extracted: ExtractedSupplier,
): Promise<MatchCandidate[]> {
  // Each contractor's cumulative match state keyed by contractor id so that a
  // row matching via multiple strategies aggregates scores + reasons.
  const merged = new Map<string, MatchCandidate>();

  const merge = (candidate: MatchCandidate) => {
    const existing = merged.get(candidate.contractorId);
    if (!existing) {
      merged.set(candidate.contractorId, candidate);
      return;
    }
    merged.set(candidate.contractorId, {
      contractorId: existing.contractorId,
      displayName: existing.displayName,
      vatIdentifier: existing.vatIdentifier,
      score: existing.score + candidate.score,
      reasons: [...existing.reasons, ...candidate.reasons],
    });
  };

  // ── Strategy 1 — VAT-ID exact (case-insensitive) ──────────────────────────
  const vatId = extracted.supplierVatId?.trim();
  if (vatId) {
    try {
      const hit = await db.contractor.findFirst({
        where: {
          organizationId: orgId,
          vatId: { equals: vatId, mode: 'insensitive' },
        },
        select: {
          id: true,
          legalName: true,
          displayName: true,
          vatId: true,
        },
      });
      if (hit) {
        merge({
          contractorId: hit.id,
          displayName: hit.displayName,
          vatIdentifier: hit.vatId,
          score: SCORE_VAT_ID,
          reasons: [{ reason: 'VAT_ID' }],
        });
      }
    } catch (err) {
      log.warn(
        {
          orgId,
          vatId,
          err: err instanceof Error ? err.message : String(err),
        },
        'VAT_ID strategy query failed',
      );
    }
  }

  // ── Strategy 2 — Leitweg-ID exact on any linked contractor ────────────────
  const leitweg = extracted.supplierLeitwegId?.trim();
  if (leitweg) {
    try {
      const rows = await db.leitwegId.findMany({
        where: { organizationId: orgId, value: leitweg },
        include: { contractor: true },
      });
      for (const row of rows) {
        if (!row.contractor) continue;
        merge({
          contractorId: row.contractor.id,
          displayName: row.contractor.displayName,
          vatIdentifier: row.contractor.vatId,
          score: SCORE_LEITWEG_ID,
          reasons: [{ reason: 'LEITWEG_ID' }],
        });
      }
    } catch (err) {
      log.warn(
        {
          orgId,
          err: err instanceof Error ? err.message : String(err),
        },
        'LEITWEG_ID strategy query failed',
      );
    }
  }

  // ── Strategies 3 + 4 — name-based (single DB load, in-memory scan) ────────
  // Pull the org's contractors once and evaluate both exact-name and the
  // prefix-gated fuzzy sweep in memory. This avoids an N+1 pattern and keeps
  // the total DB round-trips at ≤3 regardless of org size.
  const extractedNormalised = normaliseContractorName(extracted.supplierName);
  if (extractedNormalised.length > 0) {
    const extractedPrefix = extractedNormalised.substring(0, 3);
    try {
      const allContractors = await db.contractor.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          legalName: true,
          displayName: true,
          vatId: true,
        },
      });

      for (const contractor of allContractors) {
        const candidateName = normaliseContractorName(
          contractor.legalName || contractor.displayName || '',
        );
        if (candidateName.length === 0) continue;

        // Strategy 3 — exact normalised match
        if (candidateName === extractedNormalised) {
          merge({
            contractorId: contractor.id,
            displayName: contractor.displayName,
            vatIdentifier: contractor.vatId,
            score: SCORE_EXACT_NAME,
            reasons: [{ reason: 'EXACT_NAME' }],
          });
          continue; // never double-count exact + fuzzy on the same row
        }

        // Strategy 4 — fuzzy, prefix-gated
        if (candidateName.substring(0, 3) !== extractedPrefix) continue;
        const distance = levenshtein(candidateName, extractedNormalised);
        if (distance <= FUZZY_MAX_DISTANCE) {
          merge({
            contractorId: contractor.id,
            displayName: contractor.displayName,
            vatIdentifier: contractor.vatId,
            score: SCORE_FUZZY_BASE - distance * 5,
            reasons: [
              { reason: 'FUZZY_NAME', detail: `distance ${distance}` },
            ],
          });
        }
      }
    } catch (err) {
      log.warn(
        {
          orgId,
          err: err instanceof Error ? err.message : String(err),
        },
        'Name strategy query failed',
      );
    }
  }

  // ── Sort desc by score, stable tie-break on contractorId ──────────────────
  const ranked = [...merged.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.contractorId.localeCompare(b.contractorId);
  });

  return ranked.slice(0, MAX_CANDIDATES);
}

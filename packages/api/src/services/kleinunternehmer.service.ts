// ---------------------------------------------------------------------------
// Phase 57 · Plan 03 · Task 3 — kleinunternehmer.service
// ---------------------------------------------------------------------------
//
// § 19 UStG — Kleinunternehmerregelung (German small-business VAT exemption).
//
// When an organization is a DE-registered Kleinunternehmer:
//   1. Every invoice line with a taxable rate is force-rewritten to `KU`
//      (0% exempt; seeded in Plan 57-01 tax-rates).
//   2. The invoice footer renders `TAX_KLEINUNTERNEHMER_NOTICE`
//      ("Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen" — locked in
//      Plan 57-01 packages/validators/src/legal/de.ts).
//   3. The VAT breakdown row is suppressed entirely — printing "0% VAT" or
//      "VAT: 0,00 €" creates ambiguity about whether the customer could
//      still be liable (RESEARCH Pitfall 7). The only correct rendering is
//      "no VAT column at all, plus § 19 UStG notice."
//
// Precedence rule (D-11 + D-12):
//   RC (reverse charge) legally attributes VAT liability to the buyer.
//   KU is an exemption for the seller's own revenue. Only ONE of these can
//   apply to a given line. If a line is already flagged RC by the reverse-
//   charge service (upstream), we leave it RC — the legal attribution wins.
//
// This service is pure — it takes a line + org snapshot and returns the
// override result. The tRPC router in Plan 57-04 is responsible for
// loading `org.isKleinunternehmer` from Prisma (tenant-scoped). No Prisma
// calls here: keeps the service trivially testable and re-entrant (the
// invoice preview endpoint calls this on every keystroke).
// ---------------------------------------------------------------------------

export interface KleinunternehmerOverrideResult {
  vatRate: string;
  forced: boolean;
  reason?: string;
}

export function applyKleinunternehmerOverride(
  line: { vatRate: string | null; description?: string },
  org: { countryCode: string | null; isKleinunternehmer: boolean },
): KleinunternehmerOverrideResult {
  const original = line.vatRate ?? '';

  // Guard: only applies to DE Kleinunternehmer orgs.
  if (org.countryCode !== 'DE' || !org.isKleinunternehmer) {
    return { vatRate: original, forced: false };
  }

  // Precedence: RC (reverse charge) wins over KU (exemption). See module
  // docs — legal attribution takes priority over small-business rule.
  if (original === 'RC') {
    return {
      vatRate: 'RC',
      forced: false,
      reason: 'Reverse charge takes precedence over Kleinunternehmer',
    };
  }

  return {
    vatRate: 'KU',
    forced: true,
    reason: '§19 UStG Kleinunternehmerregelung',
  };
}

/**
 * Returns true iff the VAT breakdown row should be omitted from invoice
 * totals. See RESEARCH Pitfall 7 — rendering "0% VAT" confuses customers
 * into thinking the exemption is a rate; the only legally-clean output is
 * a missing breakdown plus the § 19 notice.
 */
export function shouldSuppressVatBreakdown(org: {
  countryCode: string | null;
  isKleinunternehmer: boolean;
}): boolean {
  return org.countryCode === 'DE' && org.isKleinunternehmer === true;
}

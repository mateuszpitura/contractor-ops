// DE Werkvertrag IP-clause phrase library.
//
// =============================================================================
// CRITICAL — Werkvertrag legal context (engineering summary; NOT legal advice):
//
// §7 UrhG (Schöpferprinzip): the creator (natural person) is the author.
// Authorship is INALIENABLE. Corporate entities cannot be original authors.
//
// §31 UrhG: only Nutzungsrechte (usage rights) — exclusive
// (`ausschließliches Nutzungsrecht`) or non-exclusive (`einfaches Nutzungsrecht`)
// — can be granted to the customer. There is no concept of "assignment" of
// authorship in DE law equivalent to UK CDPA s.90(1).
//
// §31 Abs. 5 UrhG (Zweckübertragungsregel): the scope of granted rights extends
// only as far as the contractual purpose requires. Silent contracts narrow the
// grant.
//
// §31a UrhG: rights for unknown future uses require explicit form requirements.
//
// IMPLICATION: UK-style "hereby assigns" boilerplate is INSUFFICIENT under DE
// law because it attempts what §7 UrhG forbids. The verdict engine triggers
// MANUAL_REVIEW_REQUIRED with crossJurisdictionMismatch when only UK-namespace
// phrases match a DE-jurisdiction contract.
// =============================================================================
//
// Legal sign-off: PENDING per Standing Constraint. Production wording flips
// PENDING → APPROVED via post-deploy PR per Steuerberater + Werkvertrag-aware
// adviser, each carrying upstreamRef.

export const IP_CLAUSES_DE = {
  'de.urheberrecht_einraeumung@v1': {
    regex:
      /Einr[äa]umung\s+(eines|von)\s+(ausschlie[ßs]lich(en|es)|einfach(en|es))\s+Nutzungsrecht(en|s|e)?/i,
    citedTextExample:
      'Der Auftragnehmer räumt dem Auftraggeber ein ausschließliches, räumlich und zeitlich unbeschränktes Nutzungsrecht gemäß §31 UrhG ein.',
    locale: 'de' as const,
    jurisdiction: 'DE' as const,
    sufficiencyForJurisdiction: 'DE' as const,
    legalBasisRef: 'UrhG §31 (Einräumung von Nutzungsrechten)',
    version: 1 as const,
  },
  'de.ausschliessliches_nutzungsrecht@v1': {
    regex: /ausschlie[ßs]lich(es|en)\s+Nutzungsrecht/i,
    citedTextExample: 'ausschließliches Nutzungsrecht für sämtliche Nutzungsarten',
    locale: 'de' as const,
    jurisdiction: 'DE' as const,
    sufficiencyForJurisdiction: 'DE' as const,
    legalBasisRef: 'UrhG §31 Abs. 3',
    version: 1 as const,
  },
  'de.einfaches_nutzungsrecht@v1': {
    regex: /einfach(es|en)\s+Nutzungsrecht/i,
    citedTextExample: 'einfaches Nutzungsrecht zur internen Verwendung',
    locale: 'de' as const,
    jurisdiction: 'DE' as const,
    sufficiencyForJurisdiction: 'DE' as const,
    legalBasisRef: 'UrhG §31 Abs. 2',
    version: 1 as const,
  },
  'de.werkvertrag_zweckuebertragung@v1': {
    regex: /Zweck(übertragung|uebertragung)/i,
    citedTextExample: 'im Rahmen des Vertragszwecks gemäß §31 Abs. 5 UrhG',
    locale: 'de' as const,
    jurisdiction: 'DE' as const,
    sufficiencyForJurisdiction: 'DE' as const,
    legalBasisRef: 'UrhG §31 Abs. 5 (Zweckübertragungsregel)',
    version: 1 as const,
  },
} as const;

export type DeIpClausePhraseId = keyof typeof IP_CLAUSES_DE;

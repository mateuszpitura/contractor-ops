// Phase 75 D-14 — US IP-clause phrase library. Legal sign-off PENDING; production
// wording via post-deploy PR by US tax/IP adviser.

export const IP_CLAUSES_US = {
  'us.work_made_for_hire@v1': {
    regex: /work[s]?\s+made\s+for\s+hire/i,
    citedTextExample: 'shall be deemed a work made for hire under 17 U.S.C. §201(b)',
    locale: 'en' as const,
    jurisdiction: 'US' as const,
    sufficiencyForJurisdiction: 'US' as const,
    legalBasisRef: '17 U.S.C. §201(b)',
    version: 1 as const,
  },
  'us.assignment_in_lieu@v1': {
    regex:
      /(if|to\s+the\s+extent)\s+(such\s+)?work\s+(is|does\s+not)\s+(not\s+)?qualif(y|ied)\s+as\s+(a\s+)?work\s+made\s+for\s+hire/i,
    citedTextExample:
      'to the extent such Work does not qualify as a work made for hire, Contractor hereby assigns…',
    locale: 'en' as const,
    jurisdiction: 'US' as const,
    sufficiencyForJurisdiction: 'US' as const,
    legalBasisRef: '17 U.S.C. §204(a) (assignment fallback)',
    version: 1 as const,
  },
  'us.further_assurances@v1': {
    regex: /further\s+assurances|execute\s+(any|such)\s+(further\s+)?(documents?|instruments?)/i,
    citedTextExample:
      'agrees to execute any further documents required to perfect the foregoing assignment',
    locale: 'en' as const,
    jurisdiction: 'US' as const,
    sufficiencyForJurisdiction: 'US' as const,
    legalBasisRef: '17 U.S.C. §204(a) writing requirement',
    version: 1 as const,
  },
} as const;

export type UsIpClausePhraseId = keyof typeof IP_CLAUSES_US;

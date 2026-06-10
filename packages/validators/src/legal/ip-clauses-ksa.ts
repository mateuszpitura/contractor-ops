// KSA IP-clause phrase library. Legal sign-off PENDING.

export const IP_CLAUSES_KSA = {
  'ksa.transfer_of_economic_rights@v1': {
    regex: /transfer\s+of\s+economic\s+rights|نقل\s+الحقوق\s+المالية/i,
    citedTextExample:
      'transfer of all economic rights to the Employer pursuant to the Saudi Copyright Law',
    locale: 'en' as const,
    jurisdiction: 'KSA' as const,
    sufficiencyForJurisdiction: 'KSA' as const,
    legalBasisRef: 'Saudi Copyright Law (Royal Decree M/41) Art. 22',
    version: 1 as const,
  },
  'ksa.scope_and_term@v1': {
    regex: /(scope|term|duration)\s+of\s+(use|exploitation|the\s+transfer)/i,
    citedTextExample: 'specifying the scope, purpose, term and territory of exploitation',
    locale: 'en' as const,
    jurisdiction: 'KSA' as const,
    sufficiencyForJurisdiction: 'KSA' as const,
    legalBasisRef: 'Saudi Copyright Law Art. 22 (writing requirement)',
    version: 1 as const,
  },
} as const;

export type KsaIpClausePhraseId = keyof typeof IP_CLAUSES_KSA;

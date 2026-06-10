// UAE IP-clause phrase library. Legal sign-off PENDING.

export const IP_CLAUSES_UAE = {
  'uae.disposition_of_economic_rights@v1': {
    regex: /(disposition|assignment)\s+of\s+(economic|financial)\s+rights/i,
    citedTextExample: 'disposes of his economic rights pursuant to Federal Law No. 38 of 2021',
    locale: 'en' as const,
    jurisdiction: 'UAE' as const,
    sufficiencyForJurisdiction: 'UAE' as const,
    legalBasisRef: 'UAE Federal Law No. 38 of 2021 Art. 9',
    version: 1 as const,
  },
  'uae.written_form@v1': {
    regex: /in\s+writing|specify(ing)?\s+the\s+rights/i,
    citedTextExample:
      'such disposition is in writing and specifies the rights, purpose, duration and place of exploitation',
    locale: 'en' as const,
    jurisdiction: 'UAE' as const,
    sufficiencyForJurisdiction: 'UAE' as const,
    legalBasisRef: 'UAE Federal Law No. 38 of 2021 Art. 9 (form requirements)',
    version: 1 as const,
  },
} as const;

export type UaeIpClausePhraseId = keyof typeof IP_CLAUSES_UAE;

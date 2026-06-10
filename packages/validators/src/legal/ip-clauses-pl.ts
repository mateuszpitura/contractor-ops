// PL IP-clause phrase library. Legal sign-off PENDING; production
// wording via post-deploy PR by doradca podatkowy.

export const IP_CLAUSES_PL = {
  'pl.przeniesienie_majatkowych@v1': {
    regex: /przeniesieni(e|a)\s+autorskich\s+praw\s+maj[ąa]tkowych/i,
    citedTextExample: 'Wykonawca przenosi na Zamawiającego autorskie prawa majątkowe',
    locale: 'pl' as const,
    jurisdiction: 'PL' as const,
    sufficiencyForJurisdiction: 'PL' as const,
    legalBasisRef: 'Ustawa o prawie autorskim art. 41 (przeniesienie autorskich praw majątkowych)',
    version: 1 as const,
  },
  'pl.pola_eksploatacji@v1': {
    regex: /pol(a|ach)\s+eksploatacji/i,
    citedTextExample: 'na wszystkich znanych polach eksploatacji',
    locale: 'pl' as const,
    jurisdiction: 'PL' as const,
    sufficiencyForJurisdiction: 'PL' as const,
    legalBasisRef: 'Ustawa o prawie autorskim art. 50',
    version: 1 as const,
  },
  'pl.licencja_wylaczna@v1': {
    regex: /licencj(a|i)\s+wyłączn(a|ej|ą)/i,
    citedTextExample: 'udziela licencji wyłącznej',
    locale: 'pl' as const,
    jurisdiction: 'PL' as const,
    sufficiencyForJurisdiction: 'PL' as const,
    legalBasisRef: 'Ustawa o prawie autorskim art. 67 ust. 2',
    version: 1 as const,
  },
} as const;

export type PlIpClausePhraseId = keyof typeof IP_CLAUSES_PL;

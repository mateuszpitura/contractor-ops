// packages/validators/src/legal/compliance-uk.ts
//
// LOCKED COMPL DOC NAMES — UK.
//
// Per-jurisdiction locked-phrase registry keyed by PolicyRuleId.
// Per-locale phrase map: en + pl + de + ar (ar is REQUIRED so the i18n:parity
// guard — which peers en against [de, pl, ar] — stays green. Gulf terminology
// refinement + RTL polish are deferred; this module only guarantees the
// ar KEY exists, interim-mirroring en where no authoritative UK-context Arabic term
// is at hand).
//
// DO NOT add any of these identifiers as keys in messages/*.json —
// the CI guard in __tests__/compl-doc-names-parity.test.ts will fail the build.
//
// Each entry ships PENDING in signoff-registry.json.
// UK legal adviser flips entries to APPROVED in dedicated PRs each carrying
// a `legalTicketRef`. Production deploy gate: zero PENDING entries in scope.

export const LOCKED_COMPL_NAMES_UK = {
  'uk.right_to_work@v1': {
    en: 'UK Right-to-Work Share Code',
    pl: 'Kod udostępniania prawa do pracy (UK)',
    de: 'UK Right-to-Work Share-Code',
    ar: 'UK Right-to-Work Share Code', // TODO ar legal review deferred (Gulf terminology refinement)
  },
  'uk.utr@v1': {
    en: 'HMRC Unique Taxpayer Reference (UTR)',
    pl: 'HMRC Unique Taxpayer Reference (UTR)',
    de: 'HMRC Unique Taxpayer Reference (UTR)',
    ar: 'HMRC Unique Taxpayer Reference (UTR)', // TODO ar legal review deferred (Gulf terminology refinement)
  },
  'uk.business_registration@v1': {
    en: 'Companies House Business Registration',
    pl: 'Rejestracja działalności w Companies House',
    de: 'Companies-House-Gewerberegistrierung',
    ar: 'Companies House Business Registration', // TODO ar legal review deferred (Gulf terminology refinement)
  },
  'uk.sds@v1': {
    en: 'IR35 Status Determination Statement',
    pl: 'Oświadczenie o ustaleniu statusu IR35',
    de: 'IR35-Statusfeststellungserklärung',
    ar: 'IR35 Status Determination Statement', // TODO ar legal review deferred (Gulf terminology refinement)
  },
  'uk.ip_assignment@v1': {
    en: 'UK Intellectual Property Assignment',
    pl: 'Przeniesienie praw własności intelektualnej (UK)',
    de: 'UK Übertragung geistigen Eigentums',
    ar: 'UK Intellectual Property Assignment', // TODO ar legal review deferred (Gulf terminology refinement)
  },
} as const;

const Typecheck: Record<string, { en: string; pl: string; de: string; ar: string }> =
  LOCKED_COMPL_NAMES_UK;
void Typecheck;

/** policyRuleIds covered by this jurisdiction module — used by parity guard. */
export const RESERVED_COMPL_KEYS_UK = Object.keys(LOCKED_COMPL_NAMES_UK) as Array<
  keyof typeof LOCKED_COMPL_NAMES_UK
>;

/** Literal-union of jurisdiction-specific keys. */
export type LockedComplNameKeyUK = keyof typeof LOCKED_COMPL_NAMES_UK;

// packages/validators/src/legal/de.ts
//
// LOCKED GERMAN LEGAL PHRASES — Phase 56 (FOUND-04; D-05, D-06, D-07).
//
// SCOPE: GDPR notice phrasing + profile/onboarding tax labels only.
//        Invoice phrases (e.g. "Steuerschuldnerschaft des Leistungsempfängers")
//        are locked in Phase 61/62 when those documents are generated (D-07).
//
// DO NOT add any of these identifiers as keys in messages/*.json —
// the CI guard in __tests__/locked-phrases-guard.test.ts will fail the build.
//
// DO NOT translate these strings or move them into a translation file.
// They are legally vetted canonical forms (BfDI-aligned, DSGVO Art. 13/14;
// UStG § 19). Steuerberater review tracked in STATE.md Blockers (D-13).

export const GDPR_CONTROLLER_LABEL =
  'Verantwortlicher im Sinne der DSGVO' as const;
export const GDPR_RIGHTS_HEADING =
  'Ihre Rechte als betroffene Person' as const;
export const GDPR_DPO_LABEL = 'Datenschutzbeauftragter' as const;
export const GDPR_COMPLAINT_HEADING =
  'Beschwerderecht bei der Aufsichtsbehörde' as const;
export const TAX_USTIDNR_LABEL =
  'Umsatzsteuer-Identifikationsnummer (USt-IdNr)' as const;
export const TAX_STEUERNUMMER_LABEL = 'Steuernummer' as const;
export const TAX_HANDELSREGISTER_LABEL = 'Handelsregisternummer' as const;
export const TAX_SOZIALVERSICHERUNGSNUMMER_LABEL =
  'Sozialversicherungsnummer' as const;
export const TAX_KLEINUNTERNEHMER_LABEL =
  'Kleinunternehmer gemäß § 19 UStG' as const;

/**
 * Identifier names that the CI guard forbids in any `messages/*.json` file.
 * Keeping this list in sync with `LOCKED_DE_PHRASES` is enforced by the guard.
 */
export const RESERVED_LEGAL_KEYS = [
  'GDPR_CONTROLLER_LABEL',
  'GDPR_RIGHTS_HEADING',
  'GDPR_DPO_LABEL',
  'GDPR_COMPLAINT_HEADING',
  'TAX_USTIDNR_LABEL',
  'TAX_STEUERNUMMER_LABEL',
  'TAX_HANDELSREGISTER_LABEL',
  'TAX_SOZIALVERSICHERUNGSNUMMER_LABEL',
  'TAX_KLEINUNTERNEHMER_LABEL',
] as const;

/**
 * Canonical record of every locked DE phrase. Consumers should import from
 * here rather than inlining the strings to keep a single source of truth.
 */
export const LOCKED_DE_PHRASES = {
  GDPR_CONTROLLER_LABEL,
  GDPR_RIGHTS_HEADING,
  GDPR_DPO_LABEL,
  GDPR_COMPLAINT_HEADING,
  TAX_USTIDNR_LABEL,
  TAX_STEUERNUMMER_LABEL,
  TAX_HANDELSREGISTER_LABEL,
  TAX_SOZIALVERSICHERUNGSNUMMER_LABEL,
  TAX_KLEINUNTERNEHMER_LABEL,
} as const;

/** Literal-union type of the 9 locked-phrase identifiers. */
export type LockedDePhraseKey = keyof typeof LOCKED_DE_PHRASES;

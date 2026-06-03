// packages/validators/src/legal/ae.ts
//
// LOCKED AE (UAE) LEGAL PHRASES — Phase 79 (GULF-09, D-14/D-15).
//
// Statutory identifiers ONLY (D-14): UAE free-zone authority legal names. These
// are the canonical legal-entity names of the licensing authorities behind each
// recordable free zone (UaeFreeZoneCode). They are referenced by KEY from the
// UaeFreeZone lookup (authorityLegalNameKey) — never stored as free text, never
// translated, never placed in messages/*.json.
//
// DO NOT add any of these identifiers as keys in messages/*.json —
// the CI guard in __tests__/locked-phrases-guard.test.ts will fail the build.
//
// DO NOT translate these strings or move them into a translation file.
// They are statutory authority names; legal sign-off is tracked as a
// post-deploy item per Standing Project Constraints (PENDING legal review).

export const DIFC_AUTHORITY_LEGAL_NAME = 'Dubai International Financial Centre Authority' as const; // PENDING legal review

export const DMCC_AUTHORITY_LEGAL_NAME = 'Dubai Multi Commodities Centre Authority' as const; // PENDING legal review

export const IFZA_AUTHORITY_LEGAL_NAME = 'International Free Zone Authority' as const; // PENDING legal review

export const DUBAI_INTERNET_CITY_AUTHORITY_LEGAL_NAME = 'Dubai Development Authority' as const; // PENDING legal review

export const DUBAI_MEDIA_CITY_AUTHORITY_LEGAL_NAME = 'Dubai Development Authority' as const; // PENDING legal review

export const MEYDAN_FZ_AUTHORITY_LEGAL_NAME = 'Meydan Free Zone LLC' as const; // PENDING legal review

export const JAFZA_AUTHORITY_LEGAL_NAME = 'Jebel Ali Free Zone Authority' as const; // PENDING legal review

export const SHAMS_AUTHORITY_LEGAL_NAME = 'Sharjah Media City Free Zone Authority' as const; // PENDING legal review

export const RAKEZ_AUTHORITY_LEGAL_NAME = 'Ras Al Khaimah Economic Zone Authority' as const; // PENDING legal review

export const ADGM_AUTHORITY_LEGAL_NAME = 'Abu Dhabi Global Market' as const; // PENDING legal review

export const MAINLAND_AUTHORITY_LEGAL_NAME = 'Department of Economic Development' as const; // PENDING legal review — DED-licensed Mainland regime

/**
 * Identifier names that the CI guard forbids in any `messages/*.json` file.
 */
export const RESERVED_AE_LEGAL_KEYS = [
  'DIFC_AUTHORITY_LEGAL_NAME',
  'DMCC_AUTHORITY_LEGAL_NAME',
  'IFZA_AUTHORITY_LEGAL_NAME',
  'DUBAI_INTERNET_CITY_AUTHORITY_LEGAL_NAME',
  'DUBAI_MEDIA_CITY_AUTHORITY_LEGAL_NAME',
  'MEYDAN_FZ_AUTHORITY_LEGAL_NAME',
  'JAFZA_AUTHORITY_LEGAL_NAME',
  'SHAMS_AUTHORITY_LEGAL_NAME',
  'RAKEZ_AUTHORITY_LEGAL_NAME',
  'ADGM_AUTHORITY_LEGAL_NAME',
  'MAINLAND_AUTHORITY_LEGAL_NAME',
] as const;

/**
 * Canonical record of every locked AE phrase, keyed to the UaeFreeZone
 * lookup's `authorityLegalNameKey`.
 */
export const LOCKED_AE_PHRASES = {
  DIFC_AUTHORITY_LEGAL_NAME,
  DMCC_AUTHORITY_LEGAL_NAME,
  IFZA_AUTHORITY_LEGAL_NAME,
  DUBAI_INTERNET_CITY_AUTHORITY_LEGAL_NAME,
  DUBAI_MEDIA_CITY_AUTHORITY_LEGAL_NAME,
  MEYDAN_FZ_AUTHORITY_LEGAL_NAME,
  JAFZA_AUTHORITY_LEGAL_NAME,
  SHAMS_AUTHORITY_LEGAL_NAME,
  RAKEZ_AUTHORITY_LEGAL_NAME,
  ADGM_AUTHORITY_LEGAL_NAME,
  MAINLAND_AUTHORITY_LEGAL_NAME,
} as const;

/** Literal-union type of the locked-phrase identifiers. */
export type LockedAePhraseKey = keyof typeof LOCKED_AE_PHRASES;

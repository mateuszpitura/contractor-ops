// packages/validators/src/legal/sa.ts
//
// LOCKED SA (Saudi Arabia) LEGAL PHRASES.
//
// Statutory identifiers ONLY: Nitaqat band labels + Qiwa-authentication
// status terms. The band labels are the literal UPPER_SNAKE strings matching the
// `NitaqatBand` Prisma enum — they are the official Nitaqat tier identifiers and
// must never drift via translation. The system NEVER auto-computes the band
// (locked anti-feature); these constants only LABEL a manually-entered band.
//
// DO NOT add any of these identifiers as keys in messages/*.json —
// the CI guard in __tests__/locked-phrases-guard.test.ts will fail the build.
//
// DO NOT translate these strings or move them into a translation file.
// Legal sign-off is tracked as a post-deploy item per Standing Project
// Constraints (PENDING legal review).

// Nitaqat band labels — literal UPPER_SNAKE strings matching the NitaqatBand enum.
export const NITAQAT_BAND_PLATINUM = 'PLATINUM' as const; // PENDING legal review
export const NITAQAT_BAND_HIGH_GREEN = 'HIGH_GREEN' as const; // PENDING legal review
export const NITAQAT_BAND_MID_GREEN = 'MID_GREEN' as const; // PENDING legal review
export const NITAQAT_BAND_LOW_GREEN = 'LOW_GREEN' as const; // PENDING legal review
export const NITAQAT_BAND_YELLOW = 'YELLOW' as const; // PENDING legal review — folded into Red (2025); retained for manual/historical entry
export const NITAQAT_BAND_RED = 'RED' as const; // PENDING legal review

// Qiwa-authentication status terms (2026-04-15 requirement).
export const QIWA_CONTRACT_AUTHENTICATED_LABEL = 'Qiwa-authenticated contract' as const; // PENDING legal review
export const QIWA_CONTRACT_NOT_AUTHENTICATED_LABEL = 'Qiwa authentication pending' as const; // PENDING legal review

/**
 * Identifier names that the CI guard forbids in any `messages/*.json` file.
 */
export const RESERVED_SA_LEGAL_KEYS = [
  'NITAQAT_BAND_PLATINUM',
  'NITAQAT_BAND_HIGH_GREEN',
  'NITAQAT_BAND_MID_GREEN',
  'NITAQAT_BAND_LOW_GREEN',
  'NITAQAT_BAND_YELLOW',
  'NITAQAT_BAND_RED',
  'QIWA_CONTRACT_AUTHENTICATED_LABEL',
  'QIWA_CONTRACT_NOT_AUTHENTICATED_LABEL',
] as const;

/**
 * Canonical record of every locked SA phrase.
 */
export const LOCKED_SA_PHRASES = {
  NITAQAT_BAND_PLATINUM,
  NITAQAT_BAND_HIGH_GREEN,
  NITAQAT_BAND_MID_GREEN,
  NITAQAT_BAND_LOW_GREEN,
  NITAQAT_BAND_YELLOW,
  NITAQAT_BAND_RED,
  QIWA_CONTRACT_AUTHENTICATED_LABEL,
  QIWA_CONTRACT_NOT_AUTHENTICATED_LABEL,
} as const;

/** Literal-union type of the locked-phrase identifiers. */
export type LockedSaPhraseKey = keyof typeof LOCKED_SA_PHRASES;

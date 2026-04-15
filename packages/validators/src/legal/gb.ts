// packages/validators/src/legal/gb.ts
//
// LOCKED GB LEGAL PHRASES — Phase 63 (D-17).
//
// Late Payment of Commercial Debts (Interest) Act 1998 as amended by the
// Late Payment of Commercial Debts Regulations 2013.
//
// DO NOT add any of these identifiers as keys in messages/*.json —
// the CI guard in __tests__/locked-phrases-guard.test.ts will fail the build.
//
// DO NOT translate these strings or move them into a translation file.
// They are legally vetted canonical forms from the LPCDA statutory text.
// Legal sign-off tracked as post-deploy item per Standing Project Constraints.

export const LPCDA_CLAIM_FOOTER =
  'This claim is made under the Late Payment of Commercial Debts (Interest) Act 1998 as amended by the Late Payment of Commercial Debts Regulations 2013.' as const;

export const LPCDA_STATUTORY_RATE_LABEL =
  'Bank of England base rate plus 8 percentage points' as const;

export const LPCDA_COMPENSATION_LABEL =
  'Fixed sum compensation under Section 5A' as const;

export const LPCDA_SECTION_REF =
  'Late Payment of Commercial Debts (Interest) Act 1998, Sections 3, 4, and 5A' as const;

/**
 * Identifier names that the CI guard forbids in any `messages/*.json` file.
 */
export const RESERVED_GB_LEGAL_KEYS = [
  'LPCDA_CLAIM_FOOTER',
  'LPCDA_STATUTORY_RATE_LABEL',
  'LPCDA_COMPENSATION_LABEL',
  'LPCDA_SECTION_REF',
] as const;

/**
 * Canonical record of every locked GB phrase.
 */
export const LOCKED_GB_PHRASES = {
  LPCDA_CLAIM_FOOTER,
  LPCDA_STATUTORY_RATE_LABEL,
  LPCDA_COMPENSATION_LABEL,
  LPCDA_SECTION_REF,
} as const;

/** Literal-union type of the locked-phrase identifiers. */
export type LockedGbPhraseKey = keyof typeof LOCKED_GB_PHRASES;

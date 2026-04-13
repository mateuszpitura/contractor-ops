// packages/validators/src/legal/en.ts
//
// LOCKED UK LEGAL PHRASES — Phase 57 (PAY-04, D-14).
//
// Mirror of legal/de.ts for UK-side locked invoice footer phrasing.
// Do NOT add these identifiers as keys in messages/*.json — CI guard
// in __tests__/locked-phrases-guard.test.ts enforces this.

export const TAX_UK_REVERSE_CHARGE_NOTICE =
  'Reverse charge: Customer to pay the VAT to HMRC' as const;

export const RESERVED_EN_LEGAL_KEYS = [
  'TAX_UK_REVERSE_CHARGE_NOTICE',
] as const;

export const LOCKED_EN_PHRASES = {
  TAX_UK_REVERSE_CHARGE_NOTICE,
} as const;

export type LockedEnPhraseKey = keyof typeof LOCKED_EN_PHRASES;

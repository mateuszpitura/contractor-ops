// packages/validators/src/legal/en.ts
//
// LOCKED UK LEGAL PHRASES — Phase 57 (PAY-04, D-14).
//
// Mirror of legal/de.ts for UK-side locked invoice footer phrasing.
// Do NOT add these identifiers as keys in messages/*.json — CI guard
// in __tests__/locked-phrases-guard.test.ts enforces this.

export const TAX_UK_REVERSE_CHARGE_NOTICE =
  'Reverse charge: Customer to pay the VAT to HMRC' as const;

// Phase 59 · D-03 — locked IR35 dispute-process text for SDS final page.
// Universal per HMRC off-payroll rules (ITEPA 2003 Chapter 10). 45-day challenge window,
// client review obligation, client response timeframe.
// PENDING UK tax-adviser sign-off (see Phase 59 Plan 59-01 Task 3 MANUAL-REVIEW checkpoint).
export const IR35_DISPUTE_PROCESS_EN =
  'Dispute process: If you disagree with this Status Determination Statement, you may ' +
  'challenge it in writing within 45 days of receiving it (per ITEPA 2003 Chapter 10). ' +
  'Send your challenge to the client named in this SDS, stating your reasons and ' +
  'providing supporting evidence. The client must: (1) consider your representations; ' +
  '(2) decide whether the determination should be withdrawn, maintained, or reissued; ' +
  '(3) provide a reasoned response within 45 days of receiving your challenge. Until the ' +
  'client responds, the original determination continues to apply. If the client fails ' +
  'to respond within 45 days or does not apply reasonable care in reaching the ' +
  'determination, the client becomes the fee-payer and is liable for tax and National ' +
  'Insurance contributions. For independent advice, consult a qualified UK tax adviser.';

export const RESERVED_EN_LEGAL_KEYS = [
  'TAX_UK_REVERSE_CHARGE_NOTICE',
  'IR35_DISPUTE_PROCESS_EN',
] as const;

export const LOCKED_EN_PHRASES = {
  TAX_UK_REVERSE_CHARGE_NOTICE,
  IR35_DISPUTE_PROCESS_EN,
} as const;

export type LockedEnPhraseKey = keyof typeof LOCKED_EN_PHRASES;

// ---------------------------------------------------------------------------
// Billing / OCR credit denial reasons (camelCase tokens)
// ---------------------------------------------------------------------------

/** Returned by atomic credit check when subscription or balance blocks usage. */
export const billingCreditDenialReason = {
  noSubscription: 'noSubscription',
  creditsExhausted: 'creditsExhausted',
} as const;

export type BillingCreditDenialReason =
  (typeof billingCreditDenialReason)[keyof typeof billingCreditDenialReason];

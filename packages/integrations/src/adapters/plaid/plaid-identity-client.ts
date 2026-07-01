// Plaid Identity bank-account verification seam.
//
// Mirrors the tin-match client seam (a focused interface + a deterministic mock
// default + a flag-dark live concrete). Plaid Identity answers whether the name
// on a US bank account matches the contractor's legal name — an anti-fraud
// signal at onboarding.
//
// The posture is ADVISORY, FAIL-OPEN (mirrors the P84 USPS address-verification
// precedent): an unverified account surfaces a warning, it NEVER throws and
// NEVER blocks a payout. A deterministic MockPlaidIdentityClient is the shipped
// default; the live client sits behind this interface, dark, until the Plaid
// flag flips and credentials land. The persisted result feeds
// `ContractorBillingProfile.plaidVerificationStatus`, which the payout path
// reads as a per-item advisory.

/** The Plaid Identity verification outcome persisted per billing profile. */
export type PlaidVerificationStatus = 'VERIFIED' | 'PENDING' | 'FAILED';

/** A single bank-account verification request. */
export interface PlaidVerifyInput {
  /** The Plaid account identifier (from the Link → public_token exchange). */
  accountId: string;
  /** The contractor's legal name to match against the account holder. */
  legalName: string;
  /** The account's ABA routing number (masked on the mock/dark paths). */
  routingNumber: string;
  /** The account number (masked on the mock/dark paths). */
  accountNumber: string;
}

/** The outcome of a single verification request. */
export interface PlaidVerificationResult {
  /** VERIFIED / PENDING / FAILED — persisted to the billing profile. */
  status: PlaidVerificationStatus;
  /**
   * A human-readable advisory message present iff the status is not VERIFIED.
   * Advisory only — the caller surfaces it as a warning and never blocks.
   */
  advisoryWarning?: string;
  /** The verified Plaid account id, or null when verification did not resolve one. */
  plaidAccountId?: string | null;
  /** The Plaid Identity name-match score (0–1), when the provider returns one. */
  nameMatchScore?: number;
}

/**
 * Abstracts the Plaid Identity verification call. Implementations return the
 * status; the advisory-vs-block policy lives in the consuming service/router
 * (fail-open), not here.
 */
export interface PlaidIdentityClient {
  verify(input: PlaidVerifyInput): Promise<PlaidVerificationResult>;
}

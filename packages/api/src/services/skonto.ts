/**
 * Skonto (early payment discount) eligibility service.
 *
 * Phase 63 · Plan 06 · D-21, D-24
 *
 * Pure functions for:
 * - Resolving which SkontoTerm applies (invoice-level > billing-profile default)
 * - Evaluating eligibility based on payment date vs discount window
 *
 * All monetary values are in minor units (cents/grosze/pence) to avoid
 * floating-point precision issues per project convention.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkontoTermData = {
  discountPercent: number;
  discountPeriodDays: number;
  netPeriodDays: number;
};

export type SkontoEligibilityInput = {
  invoiceTotalMinor: number;
  invoiceIssueDate: Date;
  skontoTerm: SkontoTermData | null;
  paidAt: Date | null;
  asOf: Date;
};

export type SkontoEligibilityResult = {
  eligible: boolean;
  eligibilityReason: 'ELIGIBLE' | 'PAST_DISCOUNT_WINDOW' | 'NO_SKONTO_CONFIGURED';
  discountedAmountMinor: number;
  discountAmountMinor: number;
  netAmountMinor: number;
  discountDeadline: Date | null;
};

// ---------------------------------------------------------------------------
// resolveSkontoTerm
// ---------------------------------------------------------------------------

/**
 * Cascade resolution: invoice-level term takes priority over billing-profile
 * default. Returns null if neither is configured.
 *
 * Per D-21: invoice -> billing profile -> null.
 */
export function resolveSkontoTerm(
  invoiceTerm: SkontoTermData | null,
  profileDefault: SkontoTermData | null,
): SkontoTermData | null {
  return invoiceTerm ?? profileDefault ?? null;
}

// ---------------------------------------------------------------------------
// evaluateSkontoEligibility
// ---------------------------------------------------------------------------

/**
 * Evaluate whether an invoice qualifies for Skonto (early payment discount).
 *
 * Decision logic:
 * 1. No skonto term configured -> NO_SKONTO_CONFIGURED
 * 2. Reference date (paidAt or asOf) <= discount deadline -> ELIGIBLE
 * 3. Reference date > discount deadline -> PAST_DISCOUNT_WINDOW
 *
 * The discount amount is always computed (even for PAST_DISCOUNT_WINDOW)
 * so callers can show "you would have saved X" UI.
 */
export function evaluateSkontoEligibility(input: SkontoEligibilityInput): SkontoEligibilityResult {
  const { invoiceTotalMinor, invoiceIssueDate, skontoTerm, paidAt, asOf } = input;

  // No skonto configured — pass through original amounts
  if (skontoTerm === null) {
    return {
      eligible: false,
      eligibilityReason: 'NO_SKONTO_CONFIGURED',
      discountedAmountMinor: invoiceTotalMinor,
      discountAmountMinor: 0,
      netAmountMinor: invoiceTotalMinor,
      discountDeadline: null,
    };
  }

  // Calculate discount deadline: issueDate + discountPeriodDays
  const discountDeadline = new Date(invoiceIssueDate);
  discountDeadline.setDate(discountDeadline.getDate() + skontoTerm.discountPeriodDays);

  // Calculate discount amounts (always, for display purposes)
  const discountAmountMinor = Math.floor((invoiceTotalMinor * skontoTerm.discountPercent) / 100);
  const discountedAmountMinor = invoiceTotalMinor - discountAmountMinor;

  // Reference date: use paidAt if available, otherwise asOf
  const referenceDate = paidAt ?? asOf;

  // Eligibility: reference date must be on or before the deadline
  const isWithinWindow = referenceDate <= discountDeadline;

  return {
    eligible: isWithinWindow,
    eligibilityReason: isWithinWindow ? 'ELIGIBLE' : 'PAST_DISCOUNT_WINDOW',
    discountedAmountMinor,
    discountAmountMinor,
    netAmountMinor: invoiceTotalMinor,
    discountDeadline,
  };
}

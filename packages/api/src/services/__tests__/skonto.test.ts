import { describe, expect, it } from 'vitest';
import type { SkontoEligibilityInput, SkontoTermData } from '../skonto.js';
import { evaluateSkontoEligibility, resolveSkontoTerm } from '../skonto.js';

// ---------------------------------------------------------------------------
// resolveSkontoTerm
// ---------------------------------------------------------------------------

describe('resolveSkontoTerm', () => {
  const invoiceTerm: SkontoTermData = {
    discountPercent: 3,
    discountPeriodDays: 7,
    netPeriodDays: 30,
  };

  const profileDefault: SkontoTermData = {
    discountPercent: 2,
    discountPeriodDays: 14,
    netPeriodDays: 60,
  };

  it('returns invoice term when both invoice and profile defaults exist', () => {
    expect(resolveSkontoTerm(invoiceTerm, profileDefault)).toEqual(invoiceTerm);
  });

  it('returns profile default when invoice has no term', () => {
    expect(resolveSkontoTerm(null, profileDefault)).toEqual(profileDefault);
  });

  it('returns null when neither invoice nor profile has a term', () => {
    expect(resolveSkontoTerm(null, null)).toBeNull();
  });

  it('returns invoice term when profile default is null', () => {
    expect(resolveSkontoTerm(invoiceTerm, null)).toEqual(invoiceTerm);
  });
});

// ---------------------------------------------------------------------------
// evaluateSkontoEligibility
// ---------------------------------------------------------------------------

describe('evaluateSkontoEligibility', () => {
  const baseTerm: SkontoTermData = {
    discountPercent: 3,
    discountPeriodDays: 7,
    netPeriodDays: 30,
  };

  const issueDate = new Date('2026-01-10');

  it('returns NO_SKONTO_CONFIGURED when skontoTerm is null', () => {
    const input: SkontoEligibilityInput = {
      invoiceTotalMinor: 100_000,
      invoiceIssueDate: issueDate,
      skontoTerm: null,
      paidAt: null,
      asOf: new Date('2026-01-12'),
    };

    const result = evaluateSkontoEligibility(input);

    expect(result.eligible).toBe(false);
    expect(result.eligibilityReason).toBe('NO_SKONTO_CONFIGURED');
    expect(result.discountedAmountMinor).toBe(100_000);
    expect(result.discountAmountMinor).toBe(0);
    expect(result.netAmountMinor).toBe(100_000);
    expect(result.discountDeadline).toBeNull();
  });

  it('returns ELIGIBLE when unpaid and within discount window', () => {
    const input: SkontoEligibilityInput = {
      invoiceTotalMinor: 100_000, // 1000.00 EUR
      invoiceIssueDate: issueDate,
      skontoTerm: baseTerm,
      paidAt: null,
      asOf: new Date('2026-01-15'), // day 5, within 7-day window
    };

    const result = evaluateSkontoEligibility(input);

    expect(result.eligible).toBe(true);
    expect(result.eligibilityReason).toBe('ELIGIBLE');
    expect(result.discountAmountMinor).toBe(3_000); // floor(100000 * 3 / 100)
    expect(result.discountedAmountMinor).toBe(97_000);
    expect(result.netAmountMinor).toBe(100_000);
    expect(result.discountDeadline).toEqual(new Date('2026-01-17')); // issueDate + 7 days
  });

  it('returns PAST_DISCOUNT_WINDOW when unpaid and past discount window', () => {
    const input: SkontoEligibilityInput = {
      invoiceTotalMinor: 100_000,
      invoiceIssueDate: issueDate,
      skontoTerm: baseTerm,
      paidAt: null,
      asOf: new Date('2026-01-20'), // day 10, past 7-day window
    };

    const result = evaluateSkontoEligibility(input);

    expect(result.eligible).toBe(false);
    expect(result.eligibilityReason).toBe('PAST_DISCOUNT_WINDOW');
    expect(result.discountAmountMinor).toBe(3_000);
    expect(result.discountedAmountMinor).toBe(97_000);
  });

  it('returns ELIGIBLE when paid within discount window (snapshot)', () => {
    const input: SkontoEligibilityInput = {
      invoiceTotalMinor: 50_000, // 500.00 EUR
      invoiceIssueDate: issueDate,
      skontoTerm: baseTerm,
      paidAt: new Date('2026-01-14'), // day 4, within window
      asOf: new Date('2026-02-01'), // asOf is irrelevant when paidAt is set
    };

    const result = evaluateSkontoEligibility(input);

    expect(result.eligible).toBe(true);
    expect(result.eligibilityReason).toBe('ELIGIBLE');
    expect(result.discountAmountMinor).toBe(1_500); // floor(50000 * 3 / 100)
    expect(result.discountedAmountMinor).toBe(48_500);
  });

  it('returns PAST_DISCOUNT_WINDOW when paid after discount window', () => {
    const input: SkontoEligibilityInput = {
      invoiceTotalMinor: 50_000,
      invoiceIssueDate: issueDate,
      skontoTerm: baseTerm,
      paidAt: new Date('2026-01-25'), // day 15, past window
      asOf: new Date('2026-02-01'),
    };

    const result = evaluateSkontoEligibility(input);

    expect(result.eligible).toBe(false);
    expect(result.eligibilityReason).toBe('PAST_DISCOUNT_WINDOW');
  });

  it('returns ELIGIBLE on the exact deadline day', () => {
    const input: SkontoEligibilityInput = {
      invoiceTotalMinor: 100_000,
      invoiceIssueDate: issueDate,
      skontoTerm: baseTerm,
      paidAt: null,
      asOf: new Date('2026-01-17'), // exactly day 7
    };

    const result = evaluateSkontoEligibility(input);

    expect(result.eligible).toBe(true);
    expect(result.eligibilityReason).toBe('ELIGIBLE');
  });

  it('correctly floors discount amount for non-round percentages', () => {
    const term: SkontoTermData = {
      discountPercent: 2.5,
      discountPeriodDays: 10,
      netPeriodDays: 30,
    };

    const input: SkontoEligibilityInput = {
      invoiceTotalMinor: 33_333, // 333.33 EUR
      invoiceIssueDate: issueDate,
      skontoTerm: term,
      paidAt: null,
      asOf: new Date('2026-01-12'),
    };

    const result = evaluateSkontoEligibility(input);

    // floor(33333 * 2.5 / 100) = floor(833.325) = 833
    expect(result.discountAmountMinor).toBe(833);
    expect(result.discountedAmountMinor).toBe(33_333 - 833);
  });

  it('returns PAST_DISCOUNT_WINDOW one day after deadline', () => {
    const input: SkontoEligibilityInput = {
      invoiceTotalMinor: 100_000,
      invoiceIssueDate: issueDate,
      skontoTerm: baseTerm,
      paidAt: null,
      asOf: new Date('2026-01-18'), // day 8, one day past 7-day window
    };

    const result = evaluateSkontoEligibility(input);

    expect(result.eligible).toBe(false);
    expect(result.eligibilityReason).toBe('PAST_DISCOUNT_WINDOW');
  });
});

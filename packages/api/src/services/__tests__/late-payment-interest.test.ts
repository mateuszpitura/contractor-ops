// packages/api/src/services/__tests__/late-payment-interest.test.ts
//
// Phase 63 · Plan 03 — TDD coverage for the LPCDA-compliant late payment
// interest calculator.
//
// References:
//   - Late Payment of Commercial Debts (Interest) Act 1998 §3, §4(1), §5A
//   - Late Payment of Commercial Debts Regulations 2013 (compensation tiers)
//
// Pitfall guards (per 63-RESEARCH.md):
//   1. Statutory rate must come from the BoE rate on the LAST DAY of the
//      preceding 6-month period (30 Jun / 31 Dec) — never the current rate.
//   2. Interest is SIMPLE (not compound) — `principal * rate / 365 * days`.
//   3. Compensation tier is per LPCDA §5A based on invoice total.
//   4. Partial payments reduce the principal.
//   5. Active waivers zero out the waived component.

import { describe, expect, it } from 'vitest';
import type { LateInterestInput, RateHistoryEntry } from '../late-payment-interest';
import {
  calculateLateInterest,
  getCompensationTier,
  resolveStatutoryRate,
} from '../late-payment-interest';

// ---------------------------------------------------------------------------
// Fixtures — BoE rate history covering the test scenarios
// ---------------------------------------------------------------------------

/**
 * Realistic BoE rate history. Selected entries from the 2021–2026 cycle,
 * sufficient to verify the §4(1) reference-date lookup.
 */
const RATE_HISTORY: RateHistoryEntry[] = [
  { effectiveFrom: new Date(Date.UTC(2021, 0, 1)), ratePercent: 0.1 },
  { effectiveFrom: new Date(Date.UTC(2022, 11, 15)), ratePercent: 3.5 },
  { effectiveFrom: new Date(Date.UTC(2023, 7, 3)), ratePercent: 5.25 },
  { effectiveFrom: new Date(Date.UTC(2024, 7, 1)), ratePercent: 5.0 },
  { effectiveFrom: new Date(Date.UTC(2024, 10, 7)), ratePercent: 4.75 },
  { effectiveFrom: new Date(Date.UTC(2025, 1, 6)), ratePercent: 4.5 },
  { effectiveFrom: new Date(Date.UTC(2025, 4, 8)), ratePercent: 4.25 },
  { effectiveFrom: new Date(Date.UTC(2025, 10, 6)), ratePercent: 3.75 },
];

function makeInput(overrides: Partial<LateInterestInput> = {}): LateInterestInput {
  return {
    invoiceTotalMinor: 500_000, // £5,000
    invoiceDueDate: new Date(Date.UTC(2026, 1, 13)), // 13 Feb 2026
    currency: 'GBP',
    contractorCountryCode: 'GB',
    isBusinessCustomer: true,
    rateHistory: RATE_HISTORY,
    payments: [],
    waivers: [],
    compensationTierMinor: null,
    paidAt: null,
    asOf: new Date(Date.UTC(2026, 2, 15)), // 15 Mar 2026 → 30 days overdue
    ...overrides,
  };
}

// ===========================================================================
// resolveStatutoryRate — §4(1) reference-date lookup
// ===========================================================================

describe('resolveStatutoryRate', () => {
  it('Jan-Jun debt overdue date uses preceding 31 December as reference', () => {
    // Debt overdue 2026-03-15 → reference date 2025-12-31
    // Last rate <= 2025-12-31 in history: 3.75% (effective 2025-11-06)
    const rate = resolveStatutoryRate(RATE_HISTORY, new Date(Date.UTC(2026, 2, 15)));
    expect(rate).toBe(3.75);
  });

  it('Jul-Dec debt overdue date uses 30 June of same year as reference', () => {
    // Debt overdue 2026-08-01 → reference date 2026-06-30
    // Last rate <= 2026-06-30 in history: 3.75% (effective 2025-11-06)
    const rate = resolveStatutoryRate(RATE_HISTORY, new Date(Date.UTC(2026, 7, 1)));
    expect(rate).toBe(3.75);
  });

  it('debt overdue 1 January uses preceding 31 December (boundary check)', () => {
    // Debt overdue 2026-01-01 → reference 2025-12-31 → 3.75%
    const rate = resolveStatutoryRate(RATE_HISTORY, new Date(Date.UTC(2026, 0, 1)));
    expect(rate).toBe(3.75);
  });

  it('debt overdue 1 July uses 30 June of same year (boundary check)', () => {
    // Debt overdue 2025-07-01 → reference 2025-06-30 → 4.25% (effective 2025-05-08)
    const rate = resolveStatutoryRate(RATE_HISTORY, new Date(Date.UTC(2025, 6, 1)));
    expect(rate).toBe(4.25);
  });

  it('does NOT use the current (latest) BoE rate when later than reference date', () => {
    // The newest entry is 3.75% (effective 2025-11-06). For a debt overdue
    // in early 2025 (reference 2024-12-31), the rate must be 4.75% — the
    // rate in effect on 31 Dec 2024 — NOT 3.75%.
    const rate = resolveStatutoryRate(RATE_HISTORY, new Date(Date.UTC(2025, 1, 14)));
    expect(rate).toBe(4.75);
  });

  it('returns 0 when rate history is empty', () => {
    const rate = resolveStatutoryRate([], new Date(Date.UTC(2026, 2, 15)));
    expect(rate).toBe(0);
  });

  it('returns 0 when no entry predates the reference date', () => {
    const future: RateHistoryEntry[] = [
      { effectiveFrom: new Date(Date.UTC(2030, 0, 1)), ratePercent: 5 },
    ];
    const rate = resolveStatutoryRate(future, new Date(Date.UTC(2026, 2, 15)));
    expect(rate).toBe(0);
  });

  it('uses the latest entry when multiple entries predate the reference date', () => {
    // 2024-08-01 → 5.00, 2024-11-07 → 4.75. For debt overdue Jul–Dec 2025,
    // reference = 2025-06-30. Both predate, but the most recent (4.50% on
    // 2025-02-06) wins.
    const rate = resolveStatutoryRate(RATE_HISTORY, new Date(Date.UTC(2025, 7, 1)));
    expect(rate).toBe(4.25); // 2025-05-08 entry is the latest <= 2025-06-30
  });
});

// ===========================================================================
// getCompensationTier — LPCDA §5A 2013 Regulations
// ===========================================================================

describe('getCompensationTier', () => {
  it('returns £40 (4_000 pence) for invoice total < £1,000', () => {
    expect(getCompensationTier(99_999)).toBe(4_000);
    expect(getCompensationTier(50_000)).toBe(4_000);
    expect(getCompensationTier(0)).toBe(4_000);
  });

  it('returns £70 (7_000 pence) for invoice total £1,000 – £9,999.99', () => {
    expect(getCompensationTier(100_000)).toBe(7_000); // exactly £1,000
    expect(getCompensationTier(500_000)).toBe(7_000);
    expect(getCompensationTier(999_999)).toBe(7_000); // £9,999.99
  });

  it('returns £100 (10_000 pence) for invoice total >= £10,000', () => {
    expect(getCompensationTier(1_000_000)).toBe(10_000); // exactly £10,000
    expect(getCompensationTier(5_000_000)).toBe(10_000);
    expect(getCompensationTier(99_999_999)).toBe(10_000);
  });
});

// ===========================================================================
// calculateLateInterest — scope gates
// ===========================================================================

describe('calculateLateInterest — scope gates', () => {
  it('non-GB contractor → not applicable, reason NON_GB_INVOICE', () => {
    const result = calculateLateInterest(makeInput({ contractorCountryCode: 'DE' }));
    expect(result.applicable).toBe(false);
    expect(result.reason).toBe('NON_GB_INVOICE');
    expect(result.accruedInterestMinor).toBe(0);
  });

  it('null country code → not applicable, reason NON_GB_INVOICE', () => {
    const result = calculateLateInterest(makeInput({ contractorCountryCode: null }));
    expect(result.applicable).toBe(false);
    expect(result.reason).toBe('NON_GB_INVOICE');
  });

  it('B2C contractor → not applicable, reason B2C_TRANSACTION', () => {
    const result = calculateLateInterest(makeInput({ isBusinessCustomer: false }));
    expect(result.applicable).toBe(false);
    expect(result.reason).toBe('B2C_TRANSACTION');
    expect(result.accruedInterestMinor).toBe(0);
  });

  it('non-GBP currency → not applicable, reason NON_GBP_CURRENCY', () => {
    const result = calculateLateInterest(makeInput({ currency: 'EUR' }));
    expect(result.applicable).toBe(false);
    expect(result.reason).toBe('NON_GBP_CURRENCY');
    expect(result.accruedInterestMinor).toBe(0);
  });
});

// ===========================================================================
// calculateLateInterest — not-yet-overdue + zero-day cases
// ===========================================================================

describe('calculateLateInterest — pre-overdue', () => {
  it('asOf before due date → applicable but 0 interest, 0 days', () => {
    const result = calculateLateInterest(
      makeInput({
        invoiceDueDate: new Date(Date.UTC(2026, 4, 1)), // 1 May 2026
        asOf: new Date(Date.UTC(2026, 3, 15)), // 15 Apr 2026 — before due
      }),
    );
    expect(result.applicable).toBe(true);
    expect(result.daysOverdue).toBe(0);
    expect(result.accruedInterestMinor).toBe(0);
    expect(result.dailyInterestMinor).toBe(0);
    expect(result.totalClaimMinor).toBe(0);
  });

  it('asOf exactly on due date → applicable but 0 days overdue', () => {
    const dueDate = new Date(Date.UTC(2026, 4, 1));
    const result = calculateLateInterest(
      makeInput({
        invoiceDueDate: dueDate,
        asOf: dueDate,
      }),
    );
    expect(result.applicable).toBe(true);
    expect(result.daysOverdue).toBe(0);
    expect(result.accruedInterestMinor).toBe(0);
  });

  it('endDateMs exactly on overdueStartMs → 0 days overdue (B-05 boundary regression)', () => {
    // Boundary case: asOf is exactly the start of the first overdue day
    // (dueDate + 24h). Per LPCDA inclusive-elapsed semantics, no FULL
    // overdue day has elapsed yet at this instant — daysOverdue must be 0.
    // The pre-fix formula `(endDateMs - dueDateMs) / day` would have
    // returned 1 here, overstating the claim. This test locks the
    // corrected boundary against future regression.
    const dueDate = new Date(Date.UTC(2026, 4, 1));
    const overdueStart = new Date(Date.UTC(2026, 4, 2)); // dueDate + 1 day
    const result = calculateLateInterest(
      makeInput({
        invoiceDueDate: dueDate,
        asOf: overdueStart,
      }),
    );
    expect(result.applicable).toBe(true);
    expect(result.daysOverdue).toBe(0);
    expect(result.accruedInterestMinor).toBe(0);
  });

  it('endDateMs exactly one day past overdueStartMs → 1 day overdue (B-05 boundary regression)', () => {
    // Boundary case: asOf is exactly 24h past overdueStartMs. One full
    // overdue day has elapsed → daysOverdue = 1.
    const dueDate = new Date(Date.UTC(2026, 4, 1));
    const oneDayPastOverdueStart = new Date(Date.UTC(2026, 4, 3)); // dueDate + 2 days
    const result = calculateLateInterest(
      makeInput({
        invoiceDueDate: dueDate,
        asOf: oneDayPastOverdueStart,
      }),
    );
    expect(result.applicable).toBe(true);
    expect(result.daysOverdue).toBe(1);
  });
});

// ===========================================================================
// calculateLateInterest — core simple-interest formula
// ===========================================================================

describe('calculateLateInterest — simple interest formula', () => {
  it('29 days overdue (Feb-13-due → Mar-15-asOf), £5,000 principal, BoE 3.75% → 11.75% statutory rate', () => {
    // LPCDA-correct (B-05): days overdue counted from overdueStartMs
    // (Feb 14) through endDateMs (Mar 15) → 29 days, NOT 30.
    // Pre-fix this asserted 30; that was the off-by-one bug from CR-05 in
    // 63-VERIFICATION.md (counting the dueDate itself as overdue).
    //
    // Debt overdue 2026-02-13 → reference 2025-12-31 → 3.75%
    // statutoryRate = 3.75 + 8 = 11.75%
    // dailyInterest = 500_000 * 11.75/100 / 365 = 160.96 → 161 pence
    // accruedInterest = round(500_000 * 11.75/100 / 365 * 29) = round(4667.808) = 4668
    const result = calculateLateInterest(makeInput());
    expect(result.applicable).toBe(true);
    expect(result.daysOverdue).toBe(29);
    expect(result.rateUsed).toBe(11.75);
    expect(result.principalOutstandingMinor).toBe(500_000);
    // Daily interest unchanged (rate * principal / 365)
    expect(result.dailyInterestMinor).toBe(161);
    // Total accrued: round(500_000 * 11.75/100 / 365 * 29) = round(4667.808) = 4668
    expect(result.accruedInterestMinor).toBe(4_668);
  });

  it('does NOT compound interest — verify formula is principal * rate / 365 * days', () => {
    const result = calculateLateInterest(makeInput({ asOf: new Date(Date.UTC(2026, 3, 14)) }));
    // LPCDA-correct (B-05): 59 days, not 60 — overdueStartMs = Feb 14;
    // (Apr 14 - Feb 14) = 59. Pre-fix this asserted 60.
    expect(result.daysOverdue).toBe(59);
    // Linear scaling: same days→interest formula, just with the corrected day count.
    const expected = Math.round(((500_000 * 11.75) / 100 / 365) * 59);
    expect(result.accruedInterestMinor).toBe(expected);
    // Confirm linear: 59-day result is ~(59/29)x ≈ 2.034x the baseline 29-day result.
    // Compounding would inflate the result above the linear ratio; simple holds.
    const baseline29DayResult = calculateLateInterest(makeInput());
    const ratio = result.accruedInterestMinor / baseline29DayResult.accruedInterestMinor;
    const expectedRatio = 59 / 29; // ≈ 2.0345
    expect(ratio).toBeGreaterThan(expectedRatio - 0.02);
    expect(ratio).toBeLessThan(expectedRatio + 0.02);
  });
});

// ===========================================================================
// calculateLateInterest — partial payments
// ===========================================================================

describe('calculateLateInterest — partial payments', () => {
  it('partial payment reduces the principal for interest calculation', () => {
    // £5,000 invoice, £2,000 paid → £3,000 outstanding
    const result = calculateLateInterest(
      makeInput({
        payments: [{ amountMinor: 200_000, paidAt: new Date(Date.UTC(2026, 1, 20)) }],
      }),
    );
    expect(result.principalOutstandingMinor).toBe(300_000);
    // dailyInterest = 300_000 * 11.75 / 100 / 365 = 96.575 → 97 pence
    expect(result.dailyInterestMinor).toBe(97);
    // LPCDA-correct (B-05): 29 days, not 30 (overdueStartMs = Feb 14).
    // accrued = round(300_000 * 11.75/100 / 365 * 29) = round(2800.685) = 2801
    expect(result.accruedInterestMinor).toBe(2_801);
  });

  it('multiple partial payments are summed', () => {
    const result = calculateLateInterest(
      makeInput({
        payments: [
          { amountMinor: 100_000, paidAt: new Date(Date.UTC(2026, 1, 20)) },
          { amountMinor: 150_000, paidAt: new Date(Date.UTC(2026, 2, 1)) },
        ],
      }),
    );
    expect(result.principalOutstandingMinor).toBe(250_000); // 500k - 100k - 150k
  });

  it('payments exceeding total clamp principalOutstandingMinor to zero', () => {
    const result = calculateLateInterest(
      makeInput({
        payments: [{ amountMinor: 600_000, paidAt: new Date(Date.UTC(2026, 1, 20)) }],
      }),
    );
    expect(result.principalOutstandingMinor).toBe(0);
    expect(result.accruedInterestMinor).toBe(0);
  });
});

// ===========================================================================
// calculateLateInterest — waivers (D-15)
// ===========================================================================

describe('calculateLateInterest — waivers', () => {
  it('STATUTORY_INTEREST waiver zeros accrued interest, compensation still applies', () => {
    const result = calculateLateInterest(
      makeInput({
        compensationTierMinor: 7_000,
        waivers: [{ waiveType: 'STATUTORY_INTEREST', revokedAt: null }],
      }),
    );
    expect(result.waiverApplied).toBe(true);
    expect(result.accruedInterestMinor).toBe(0);
    expect(result.dailyInterestMinor).toBe(0);
    expect(result.compensationTierMinor).toBe(7_000);
    expect(result.totalClaimMinor).toBe(7_000);
  });

  it('COMPENSATION waiver zeros compensation, interest still accrues', () => {
    const result = calculateLateInterest(
      makeInput({
        compensationTierMinor: 7_000,
        waivers: [{ waiveType: 'COMPENSATION', revokedAt: null }],
      }),
    );
    expect(result.waiverApplied).toBe(true);
    // LPCDA-correct (B-05): 29 days, not 30. accrued = round(500_000 * 11.75/100 / 365 * 29) = 4668
    expect(result.accruedInterestMinor).toBe(4_668);
    expect(result.compensationTierMinor).toBe(0);
    expect(result.totalClaimMinor).toBe(4_668);
  });

  it('BOTH waiver zeros both accrued interest and compensation', () => {
    const result = calculateLateInterest(
      makeInput({
        compensationTierMinor: 7_000,
        waivers: [{ waiveType: 'BOTH', revokedAt: null }],
      }),
    );
    expect(result.waiverApplied).toBe(true);
    expect(result.accruedInterestMinor).toBe(0);
    expect(result.compensationTierMinor).toBe(0);
    expect(result.totalClaimMinor).toBe(0);
  });

  it('revoked waiver is ignored (revokedAt set)', () => {
    const result = calculateLateInterest(
      makeInput({
        compensationTierMinor: 7_000,
        waivers: [{ waiveType: 'BOTH', revokedAt: new Date(Date.UTC(2026, 2, 1)) }],
      }),
    );
    expect(result.waiverApplied).toBe(false);
    // LPCDA-correct (B-05): 29 days, not 30. accrued = round(500_000 * 11.75/100 / 365 * 29) = 4668
    expect(result.accruedInterestMinor).toBe(4_668);
    expect(result.compensationTierMinor).toBe(7_000);
    // total = 4_668 + 7_000 = 11_668
    expect(result.totalClaimMinor).toBe(11_668);
  });

  it('multiple waivers — at least one active applies', () => {
    const result = calculateLateInterest(
      makeInput({
        compensationTierMinor: 7_000,
        waivers: [
          { waiveType: 'COMPENSATION', revokedAt: new Date(Date.UTC(2026, 1, 1)) }, // revoked
          { waiveType: 'STATUTORY_INTEREST', revokedAt: null }, // active
        ],
      }),
    );
    expect(result.waiverApplied).toBe(true);
    expect(result.accruedInterestMinor).toBe(0);
    expect(result.compensationTierMinor).toBe(7_000);
  });
});

// ===========================================================================
// calculateLateInterest — compensation tier integration
// ===========================================================================

describe('calculateLateInterest — compensation tier', () => {
  it('uses provided compensationTierMinor when snapshotted', () => {
    const result = calculateLateInterest(
      makeInput({
        invoiceTotalMinor: 5_000_000, // £50,000 — would be tier £100
        compensationTierMinor: 4_000, // but snapshot says £40
      }),
    );
    // Snapshot wins — even though the current total is £50k
    expect(result.compensationTierMinor).toBe(4_000);
  });

  it('returns 0 compensation when null and not yet snapshotted (router responsibility)', () => {
    // The plain-function service does NOT auto-derive when null — it returns 0
    // and the router/caller is responsible for upserting an
    // InvoiceInterestCompensation row before the next read. This contract
    // matches the existing router behaviour (see late-payment-interest router
    // `getForInvoice`).
    const result = calculateLateInterest(makeInput({ compensationTierMinor: null }));
    expect(result.compensationTierMinor).toBe(0);
  });
});

// ===========================================================================
// calculateLateInterest — paid-in-full short-circuit
// ===========================================================================

describe('calculateLateInterest — fully paid', () => {
  it('paidAt set + after due date → days overdue counts up to paidAt', () => {
    const result = calculateLateInterest(
      makeInput({
        paidAt: new Date(Date.UTC(2026, 2, 15)), // 15 Mar — paid the day we asOf'd
        asOf: new Date(Date.UTC(2026, 3, 30)), // 30 Apr — checking later
      }),
    );
    // Interest stops accruing on paidAt, not asOf.
    // LPCDA-correct (B-05): 29 days, not 30 — overdueStartMs = Feb 14;
    // (Mar 15 - Feb 14) = 29. Pre-fix this asserted 30.
    expect(result.daysOverdue).toBe(29); // Feb 14 (overdueStartMs) → Mar 15
  });
});

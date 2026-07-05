// LEAVE-01 correctness contract for the append-only leave-balance engine.
//
// balance = Σ signed ledger minutes (ACCRUAL/CARRYOVER positive, DEDUCTION
// negative); entitlement = round_up(baseEntitlement(tenure) × etat) days, a
// partial day rounding UP (KP art. 154 §2); a null etat is treated as full-time
// (1.00) with a logged warning and never throws (an unset employment fraction
// must not brick balance math). Wave-0: RED until the leave-balance service lands.

import { describe, expect, it } from 'vitest';

import { computeLeaveBalance, resolveEntitlementMinutes } from '../leave-balance';

describe('computeLeaveBalance', () => {
  it('sums signed ledger minutes (accrual + carryover positive, deduction negative)', () => {
    const balance = computeLeaveBalance([
      { entryType: 'ACCRUAL', minutes: 9600 },
      { entryType: 'CARRYOVER', minutes: 480 },
      { entryType: 'DEDUCTION', minutes: -1920 },
    ]);
    expect(balance).toBe(8160);
  });

  it('returns 0 for an empty ledger', () => {
    expect(computeLeaveBalance([])).toBe(0);
  });
});

describe('resolveEntitlementMinutes', () => {
  it('scales PL full-time entitlement by tenure (20 days → 9600 minutes at 8h/day)', () => {
    const minutes = resolveEntitlementMinutes({
      jurisdiction: 'PL',
      leaveKind: 'ANNUAL',
      tenureYears: 3,
      etat: 1,
    });
    expect(minutes).toBe(20 * 480);
  });

  it('rounds a partial pro-rata day UP (PL etat 0.33 × 20 days = 6.6 → 7 days)', () => {
    const minutes = resolveEntitlementMinutes({
      jurisdiction: 'PL',
      leaveKind: 'ANNUAL',
      tenureYears: 3,
      etat: 0.33,
    });
    expect(minutes).toBe(7 * 480);
  });

  it('treats a null etat as full-time (1.00) and never throws', () => {
    expect(() =>
      resolveEntitlementMinutes({
        jurisdiction: 'PL',
        leaveKind: 'ANNUAL',
        tenureYears: 12,
        etat: null,
      }),
    ).not.toThrow();
    const minutes = resolveEntitlementMinutes({
      jurisdiction: 'PL',
      leaveKind: 'ANNUAL',
      tenureYears: 12,
      etat: null,
    });
    expect(minutes).toBe(26 * 480);
  });

  it('returns 0 when the market has no statutory rule (caller falls back to org policy)', () => {
    const minutes = resolveEntitlementMinutes({
      jurisdiction: 'US',
      leaveKind: 'ANNUAL',
      tenureYears: 5,
      etat: 1,
    });
    expect(minutes).toBe(0);
  });
});

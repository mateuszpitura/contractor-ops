// Contract for the per-market statutory leave-accrual registry.
//
// Importing the jurisdiction policy modules registers their rules by side
// effect (the same register-on-import idiom as the PolicyRule registry), so the
// test resolves the seeded values directly. Statutory numbers are cited from
// primary sources (KP art. 154, BUrlG §3, WTR 1998 reg 13/13A) and carry an
// adviser-verify annotation in draftLegalText — the VALUES are a legal-review
// checkpoint, this test only pins the encoded numbers against regression.

import { describe, expect, it } from 'vitest';

import '../policies/pl';
import '../policies/de';
import '../policies/uk';
import '../policies/uae';
import '../policies/ksa';
import { listLeaveAccrualRules, resolveLeaveAccrual } from '../leave-registry';

describe('leave-accrual registry', () => {
  it('resolves PL annual leave: 20 days under 10 years tenure, 26 at or above', () => {
    const rule = resolveLeaveAccrual('PL', 'ANNUAL');
    expect(rule).toBeDefined();
    expect(rule?.baseEntitlementDays({ tenureYears: 3 })).toBe(20);
    expect(rule?.baseEntitlementDays({ tenureYears: 9 })).toBe(20);
    expect(rule?.baseEntitlementDays({ tenureYears: 10 })).toBe(26);
    expect(rule?.baseEntitlementDays({ tenureYears: 25 })).toBe(26);
  });

  it('marks PL annual leave as pro-rata by etat with a Sep-30 carryover deadline', () => {
    const rule = resolveLeaveAccrual('PL', 'ANNUAL');
    expect(rule?.proRataByEtat).toBe(true);
    expect(rule?.carryoverPolicy.expiresMonthsIntoNextYear).toBe(9);
  });

  it('resolves DE statutory minimum (20 Arbeitstage on a 5-day week)', () => {
    const rule = resolveLeaveAccrual('DE', 'ANNUAL');
    expect(rule?.baseEntitlementDays({ tenureYears: 1 })).toBe(20);
    expect(rule?.proRataByEtat).toBe(true);
    expect(rule?.carryoverPolicy.expiresMonthsIntoNextYear).toBe(3);
  });

  it('resolves UK 5.6-week entitlement (28 days) with an 8-day carryover cap', () => {
    const rule = resolveLeaveAccrual('UK', 'ANNUAL');
    expect(rule?.baseEntitlementDays({ tenureYears: 1 })).toBe(28);
    expect(rule?.carryoverPolicy.maxDays).toBe(8);
  });

  it('resolves UAE 30-day entitlement after 1 year of service (pro-rata by etat)', () => {
    const rule = resolveLeaveAccrual('UAE', 'ANNUAL');
    expect(rule?.baseEntitlementDays({ tenureYears: 2 })).toBe(30);
    expect(rule?.baseEntitlementDays({ tenureYears: 0 })).toBe(24);
    expect(rule?.proRataByEtat).toBe(true);
  });

  it('resolves KSA annual leave: 21 days under 5 years, 30 at or above', () => {
    const rule = resolveLeaveAccrual('KSA', 'ANNUAL');
    expect(rule?.baseEntitlementDays({ tenureYears: 3 })).toBe(21);
    expect(rule?.baseEntitlementDays({ tenureYears: 5 })).toBe(30);
    expect(rule?.proRataByEtat).toBe(true);
  });

  it('returns undefined for an unregistered (jurisdiction, kind) so the caller falls back to org policy', () => {
    // US has no federal statutory paid-leave floor — intentionally unregistered.
    expect(resolveLeaveAccrual('US', 'ANNUAL')).toBeUndefined();
  });

  it('carries an adviser-verify annotation on every registered rule', () => {
    for (const rule of listLeaveAccrualRules()) {
      expect(rule.draftLegalText).toMatch(/PENDING legal review/i);
    }
  });
});

// Contract for the per-jurisdiction working-time-limit registry.
//
// Feeds the on-entry synchronous WT check and the daily rolling-window scan.
// Values cited from KP art. 129/131/151 (PL), ArbZG §3/§6 (DE) and WTR 1998
// reg 4/6 (UK); each rule carries an adviser-verify draftLegalText. This test
// pins the encoded numbers against regression, not their legal correctness.

import { describe, expect, it } from 'vitest';

import '../policies/pl';
import '../policies/de';
import '../policies/uk';
import { listWorkingTimeLimits, resolveWtLimits } from '../wt-registry';

describe('working-time-limit registry', () => {
  it('resolves PL daily norm (8h = 480 min) + 50/100 overtime premium + night window', () => {
    const rule = resolveWtLimits('PL');
    expect(rule).toBeDefined();
    expect(rule?.maxDailyMinutes).toBe(480);
    expect(rule?.overtimePremium).toEqual({ standardPct: 50, premiumPct: 100 });
    expect(rule?.nightWindow).toEqual({ startHour: 21, endHour: 7 });
    expect(rule?.weeklyOptOutAllowed).toBe(false);
  });

  it('resolves DE 10h hard daily ceiling (600 min) over the 8h norm', () => {
    const rule = resolveWtLimits('DE');
    expect(rule?.maxDailyMinutes).toBe(480);
    expect(rule?.maxDailyHardCeilingMinutes).toBe(600);
    expect(rule?.weeklyOptOutAllowed).toBe(false);
  });

  it('resolves UK weekly 48h cap (2880 min) with an individual written opt-out and no daily maximum', () => {
    const rule = resolveWtLimits('UK');
    expect(rule?.maxDailyMinutes).toBeNull();
    expect(rule?.weeklyAvgMaxMinutes).toBe(2880);
    expect(rule?.weeklyOptOutAllowed).toBe(true);
  });

  it('returns undefined for an unregistered jurisdiction', () => {
    expect(resolveWtLimits('US')).toBeUndefined();
  });

  it('carries an adviser-verify annotation on every registered rule', () => {
    for (const rule of listWorkingTimeLimits()) {
      expect(rule.draftLegalText).toMatch(/PENDING legal review/i);
    }
  });
});

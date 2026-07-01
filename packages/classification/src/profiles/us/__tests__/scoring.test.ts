// US worker-classification scoring — Wave-0 RED scaffold.
//
// `scoreUsClassification` does not exist yet, so importing `../scoring.js` fails
// at resolution and this suite is terminal-RED until the scorer lands. The
// assertions pin the rule shape the pure scorer must satisfy:
//   - the federal base is the IRS common-law three-category weighted composite
//     (behavioral / financial / relationship) — NOT the DOL 2024 economic-reality
//     rule (which is under active rulemaking and must not be the primary base);
//   - the CA-ABC (AB5) overlay is DISPOSITIVE when the work state is CA: the
//     worker defaults to employee unless all three prongs pass;
//   - §530 is a relief-eligibility FLAG on the result, never a verdict change;
//   - the reasoning string cites the triggering rule verbatim for audit defence.

import { describe, expect, it } from 'vitest';

import type { AnswerMap } from '../../../types/assessment.js';
import { scoreUsClassification } from '../scoring.js';

/** Wrap raw answer values into the AnswerMap envelope. */
function ans(map: Record<string, unknown>): AnswerMap {
  const out: AnswerMap = {};
  for (const [k, v] of Object.entries(map)) {
    out[k] = { value: v };
  }
  return out;
}

// Answers that push every federal common-law category toward employee control.
const FEDERAL_EMPLOYEE_ANSWERS = ans({
  'Q-USFED-BEH-01': 'yes',
  'Q-USFED-BEH-02': 'yes',
  'Q-USFED-FIN-01': 'no',
  'Q-USFED-REL-01': 'yes',
});

// Answers that satisfy all three AB5 prongs (genuine independent business).
const AB5_ALL_PRONGS_PASS = ans({
  'Q-USAB5-A': 'yes',
  'Q-USAB5-B': 'yes',
  'Q-USAB5-C': 'yes',
});

describe('scoreUsClassification — output shape', () => {
  it('returns a US_CLASSIFICATION outcome with verdict, ab5Flag, section530ReliefEligible and a reasoning string', () => {
    const res = scoreUsClassification({}, { workState: 'TX' });
    expect(res.outcome.kind).toBe('US_CLASSIFICATION');
    expect(['employee', 'independent-contractor', 'indeterminate']).toContain(res.outcome.verdict);
    expect(typeof res.outcome.ab5Flag).toBe('boolean');
    expect(typeof res.outcome.section530ReliefEligible).toBe('boolean');
    expect(typeof res.reasoning).toBe('string');
    expect(res.outcome.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('propagates the frozen ruleSetVersion onto the outcome', () => {
    const res = scoreUsClassification({}, { workState: 'TX' });
    expect(res.outcome.ruleSetVersion).toBe('US-2026-COMMONLAW-AB5');
  });
});

describe('scoreUsClassification — federal common-law base (NOT DOL 2024)', () => {
  it('uses the IRS common-law behavioral/financial/relationship categories as the base', () => {
    const res = scoreUsClassification(FEDERAL_EMPLOYEE_ANSWERS, { workState: 'TX' });
    // A control-heavy federal profile in a non-AB5 state leans employee off the
    // common-law test, and the reasoning names the common-law base — not the DOL
    // economic-reality rule.
    expect(res.outcome.verdict).toBe('employee');
    expect(res.reasoning).toMatch(/common.?law/i);
    expect(res.reasoning).not.toMatch(/economic reality|DOL 2024/i);
  });
});

describe('scoreUsClassification — CA-ABC (AB5) overlay is dispositive in California', () => {
  it('defaults to employee in CA unless all three AB5 prongs pass, even on an outside-leaning federal profile', () => {
    const res = scoreUsClassification(
      ans({ 'Q-USFED-FIN-01': 'yes', 'Q-USFED-BEH-01': 'no' }),
      { workState: 'CA' },
    );
    expect(res.outcome.verdict).toBe('employee');
    expect(res.outcome.ab5Flag).toBe(true);
    expect(res.reasoning).toMatch(/AB5|ABC|2775/i);
  });

  it('permits independent-contractor in CA only when all three AB5 prongs pass', () => {
    const res = scoreUsClassification(AB5_ALL_PRONGS_PASS, { workState: 'CA' });
    expect(res.outcome.verdict).toBe('independent-contractor');
  });

  it('does not apply the AB5 overlay outside California', () => {
    const res = scoreUsClassification(AB5_ALL_PRONGS_PASS, { workState: 'TX' });
    expect(res.outcome.ab5Flag).toBe(false);
  });
});

describe('scoreUsClassification — §530 is a relief flag, not a verdict change', () => {
  it('flags §530 relief eligibility without flipping an employee verdict', () => {
    const res = scoreUsClassification(
      { ...FEDERAL_EMPLOYEE_ANSWERS, ...ans({ 'Q-US530-01': 'yes', 'Q-US530-02': 'yes' }) },
      { workState: 'TX' },
    );
    expect(res.outcome.verdict).toBe('employee');
    expect(res.outcome.section530ReliefEligible).toBe(true);
  });
});

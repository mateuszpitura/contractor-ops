// IR35 area-scoring edge cases — deriveVerdict thresholds and tie-breaking.

import { describe, expect, it } from 'vitest';

import type { AnswerMap } from '../../../types/assessment.js';
import type { Ir35Area } from '../../../types/outcome.js';
import { scoreIr35Area } from '../area-scoring.js';

// ---------------------------------------------------------------------------
// Helper — same as the main area-scoring tests
// ---------------------------------------------------------------------------

function ans(map: Record<string, unknown>): AnswerMap {
  const out: AnswerMap = {};
  for (const [k, v] of Object.entries(map)) {
    out[k] = { value: v };
  }
  return out;
}

// ---------------------------------------------------------------------------
// deriveVerdict edge cases (exercised through scoreIr35Area)
// ---------------------------------------------------------------------------

describe('scoreIr35Area — verdict edge cases', () => {
  // Using the "control" area because all its yes-directions are leaning
  // (no strong signals), which makes it ideal for testing leaning thresholds.
  //
  // Control area question directions (from rule-set.ts):
  //   Q-CTRL-01: inside-leaning  (yes = inside-leaning, no = outside-leaning)
  //   Q-CTRL-02: inside-leaning
  //   Q-CTRL-03: inside-leaning
  //   Q-CTRL-04: inside-leaning
  //   Q-CTRL-05: outside-leaning (yes = outside-leaning, no = inside-leaning)
  //   Q-CTRL-06: inside-leaning

  const control: Ir35Area = 'control';

  it('returns neutral with exactly 1 leaning-inside and 0 leaning-outside (requires >= 2)', () => {
    // Only Q-CTRL-01 answered yes -> 1 inside-leaning signal.
    // deriveVerdict requires >= 2 leaning-inside to return leaning-inside.
    const result = scoreIr35Area(control, ans({ 'Q-CTRL-01': 'yes' }));

    expect(result.verdict).toBe('neutral');
  });

  it('returns strong-inside when both strong-inside and strong-outside signals exist', () => {
    // Substitution area has both strong directions:
    //   Q-SUB-01: outside-strong (yes = outside-strong)
    //   Q-SUB-05: inside-strong  (yes = inside-strong)
    // When both are yes, strong-inside is checked first and wins.
    const substitution: Ir35Area = 'substitution';
    const result = scoreIr35Area(substitution, ans({ 'Q-SUB-01': 'yes', 'Q-SUB-05': 'yes' }));

    expect(result.verdict).toBe('strong-inside');
  });

  it('returns leaning-inside with exactly 2 leaning-inside and 0 leaning-outside', () => {
    // Q-CTRL-01 yes + Q-CTRL-02 yes -> 2 inside-leaning signals, 0 outside.
    const result = scoreIr35Area(control, ans({ 'Q-CTRL-01': 'yes', 'Q-CTRL-02': 'yes' }));

    expect(result.verdict).toBe('leaning-inside');
  });

  it('returns neutral with 1 leaning-inside and 1 leaning-outside (mixed signals)', () => {
    // Q-CTRL-01 yes -> inside-leaning
    // Q-CTRL-05 yes -> outside-leaning
    // Mixed: neither threshold met -> neutral.
    const result = scoreIr35Area(control, ans({ 'Q-CTRL-01': 'yes', 'Q-CTRL-05': 'yes' }));

    expect(result.verdict).toBe('neutral');
  });

  it('returns neutral when all answers are neutral (no non-neutral signals)', () => {
    // Likert value 3 = neutral in interpretAnswer. Q-FIN-02 is likert-5.
    // But control area is all yes-no, so unanswered questions also yield no signals.
    // Providing no answers at all means zero signals -> neutral.
    const result = scoreIr35Area(control, {});

    expect(result.verdict).toBe('neutral');
    expect(result.drivingQuestionIds).toEqual([]);
  });
});

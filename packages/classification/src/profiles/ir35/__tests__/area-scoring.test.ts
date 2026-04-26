// IR35 area-scoring — per-area verdict logic and driving question selection.

import { describe, expect, it } from 'vitest';

import type { AnswerMap } from '../../../types/assessment.js';
import type { Ir35Area } from '../../../types/outcome.js';
import { scoreIr35Area } from '../area-scoring.js';

/** Shorthand: wrap raw answer values into AnswerMap entries. */
function ans(map: Record<string, unknown>): AnswerMap {
  const out: AnswerMap = {};
  for (const [k, v] of Object.entries(map)) {
    out[k] = { value: v };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Substitution area
// ---------------------------------------------------------------------------

describe('scoreIr35Area — substitution', () => {
  const area: Ir35Area = 'substitution';

  it('returns neutral when no answers provided', () => {
    const result = scoreIr35Area(area, {});
    expect(result.verdict).toBe('neutral');
    expect(result.drivingQuestionIds).toEqual([]);
  });

  it('returns strong-outside when Q-SUB-01 (unrestricted substitution) is yes', () => {
    const result = scoreIr35Area(area, ans({ 'Q-SUB-01': 'yes' }));
    expect(result.verdict).toBe('strong-outside');
    expect(result.drivingQuestionIds).toContain('Q-SUB-01');
  });

  it('returns strong-inside when Q-SUB-05 (substitution prohibited) is yes', () => {
    const result = scoreIr35Area(area, ans({ 'Q-SUB-05': 'yes' }));
    expect(result.verdict).toBe('strong-inside');
    expect(result.drivingQuestionIds).toContain('Q-SUB-05');
  });

  it('strong signal takes precedence over leaning signals', () => {
    // Q-SUB-05 yes = inside-strong, Q-SUB-02 yes = outside-leaning
    const result = scoreIr35Area(area, ans({ 'Q-SUB-05': 'yes', 'Q-SUB-02': 'yes' }));
    expect(result.verdict).toBe('strong-inside');
  });

  it('returns leaning-outside with 2+ leaning-outside and 0 leaning-inside', () => {
    // Q-SUB-02 yes = outside-leaning, Q-SUB-04 yes = outside-leaning
    const result = scoreIr35Area(area, ans({ 'Q-SUB-02': 'yes', 'Q-SUB-04': 'yes' }));
    expect(result.verdict).toBe('leaning-outside');
  });

  it('returns leaning-inside with 2+ leaning-inside and 0 leaning-outside', () => {
    // Q-SUB-03 yes = inside-leaning; Q-SUB-01 no flips outside-strong to inside-leaning
    // Q-SUB-02 no flips outside-leaning to inside-leaning
    const result = scoreIr35Area(
      area,
      ans({ 'Q-SUB-03': 'yes', 'Q-SUB-01': 'no', 'Q-SUB-02': 'no' }),
    );
    expect(result.verdict).toBe('leaning-inside');
  });

  it('returns neutral when leaning signals are mixed', () => {
    // Q-SUB-02 yes = outside-leaning, Q-SUB-03 yes = inside-leaning
    const result = scoreIr35Area(area, ans({ 'Q-SUB-02': 'yes', 'Q-SUB-03': 'yes' }));
    expect(result.verdict).toBe('neutral');
  });
});

// ---------------------------------------------------------------------------
// Control area
// ---------------------------------------------------------------------------

describe('scoreIr35Area — control', () => {
  const area: Ir35Area = 'control';

  it('returns neutral with no answers', () => {
    expect(scoreIr35Area(area, {}).verdict).toBe('neutral');
  });

  it('returns leaning-inside when 2+ inside-leaning signals present', () => {
    // Q-CTRL-01 and Q-CTRL-02 both have yes direction inside-leaning
    const result = scoreIr35Area(area, ans({ 'Q-CTRL-01': 'yes', 'Q-CTRL-02': 'yes' }));
    expect(result.verdict).toBe('leaning-inside');
  });

  it('returns leaning-outside when 2+ outside-leaning signals present', () => {
    // Q-CTRL-01 no flips inside-leaning to outside-leaning
    // Q-CTRL-02 no flips inside-leaning to outside-leaning
    // Q-CTRL-05 yes = outside-leaning
    const result = scoreIr35Area(
      area,
      ans({ 'Q-CTRL-01': 'no', 'Q-CTRL-02': 'no', 'Q-CTRL-05': 'yes' }),
    );
    expect(result.verdict).toBe('leaning-outside');
  });
});

// ---------------------------------------------------------------------------
// Financial-risk area
// ---------------------------------------------------------------------------

describe('scoreIr35Area — financial-risk', () => {
  const area: Ir35Area = 'financial-risk';

  it('handles likert-5 score: value >= 4 maps to yes direction', () => {
    // Q-FIN-02 yes direction is outside-leaning, likert 4 = yes direction
    const result = scoreIr35Area(area, { 'Q-FIN-02': { value: 4 } });
    expect(result.drivingQuestionIds).toContain('Q-FIN-02');
  });

  it('handles likert-5 score: value <= 2 maps to opposite direction', () => {
    // Q-FIN-02 yes direction is outside-leaning, likert 2 = flip to inside-leaning
    const result = scoreIr35Area(area, { 'Q-FIN-02': { value: 2 } });
    expect(result.drivingQuestionIds).toContain('Q-FIN-02');
  });

  it('handles likert-5 score: value 3 = neutral (no signal)', () => {
    const result = scoreIr35Area(area, { 'Q-FIN-02': { value: 3 } });
    expect(result.drivingQuestionIds).toEqual([]);
  });

  it('returns leaning-outside with multiple outside-leaning answers', () => {
    const result = scoreIr35Area(
      area,
      ans({ 'Q-FIN-01': 'yes', 'Q-FIN-03': 'yes', 'Q-FIN-04': 'no' }),
    );
    expect(result.verdict).toBe('leaning-outside');
  });
});

// ---------------------------------------------------------------------------
// Part-and-parcel area
// ---------------------------------------------------------------------------

describe('scoreIr35Area — part-and-parcel', () => {
  const area: Ir35Area = 'part-and-parcel';

  it('returns leaning-inside when 2+ yes answers on inside-leaning questions', () => {
    const result = scoreIr35Area(area, ans({ 'Q-PP-01': 'yes', 'Q-PP-02': 'yes' }));
    expect(result.verdict).toBe('leaning-inside');
  });

  it('returns leaning-outside when 3+ flipped answers (no on inside-leaning)', () => {
    const result = scoreIr35Area(area, ans({ 'Q-PP-01': 'no', 'Q-PP-02': 'no', 'Q-PP-03': 'no' }));
    expect(result.verdict).toBe('leaning-outside');
  });
});

// ---------------------------------------------------------------------------
// MOO area
// ---------------------------------------------------------------------------

describe('scoreIr35Area — moo', () => {
  const area: Ir35Area = 'moo';

  it('returns strong-inside when Q-MOO-03 (minimum hours guarantee) is yes', () => {
    const result = scoreIr35Area(area, ans({ 'Q-MOO-03': 'yes' }));
    expect(result.verdict).toBe('strong-inside');
    expect(result.drivingQuestionIds).toContain('Q-MOO-03');
  });

  it('returns leaning-inside with 2+ inside-leaning signals', () => {
    const result = scoreIr35Area(area, ans({ 'Q-MOO-01': 'yes', 'Q-MOO-02': 'yes' }));
    expect(result.verdict).toBe('leaning-inside');
  });

  it('returns leaning-outside when opposing signals dominate', () => {
    const result = scoreIr35Area(
      area,
      ans({ 'Q-MOO-01': 'no', 'Q-MOO-02': 'no', 'Q-MOO-04': 'yes' }),
    );
    expect(result.verdict).toBe('leaning-outside');
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: driving questions
// ---------------------------------------------------------------------------

describe('scoreIr35Area — drivingQuestionIds', () => {
  it('returns at most 3 driving question IDs', () => {
    // All 6 control questions answered yes: 5 inside-leaning + 1 outside-leaning
    const allCtrl = ans({
      'Q-CTRL-01': 'yes',
      'Q-CTRL-02': 'yes',
      'Q-CTRL-03': 'yes',
      'Q-CTRL-04': 'yes',
      'Q-CTRL-05': 'yes',
      'Q-CTRL-06': 'yes',
    });
    const result = scoreIr35Area('control', allCtrl);
    expect(result.drivingQuestionIds.length).toBeLessThanOrEqual(3);
  });

  it('sorts driving questions by magnitude (strong before leaning)', () => {
    // Q-SUB-05 yes = inside-strong (magnitude 3), Q-SUB-03 yes = inside-leaning (magnitude 1)
    const result = scoreIr35Area('substitution', ans({ 'Q-SUB-05': 'yes', 'Q-SUB-03': 'yes' }));
    expect(result.drivingQuestionIds[0]).toBe('Q-SUB-05');
  });
});

// ---------------------------------------------------------------------------
// Boolean answer handling
// ---------------------------------------------------------------------------

describe('scoreIr35Area — boolean answer variants', () => {
  it('treats boolean true as "yes"', () => {
    const resultYes = scoreIr35Area('substitution', ans({ 'Q-SUB-01': 'yes' }));
    const resultTrue = scoreIr35Area('substitution', ans({ 'Q-SUB-01': true }));
    expect(resultTrue.verdict).toBe(resultYes.verdict);
  });

  it('treats boolean false as "no"', () => {
    const resultNo = scoreIr35Area('substitution', ans({ 'Q-SUB-01': 'no' }));
    const resultFalse = scoreIr35Area('substitution', ans({ 'Q-SUB-01': false }));
    expect(resultFalse.verdict).toBe(resultNo.verdict);
  });

  it('treats undefined/null raw value as neutral', () => {
    const result = scoreIr35Area('substitution', { 'Q-SUB-01': { value: undefined } });
    expect(result.verdict).toBe('neutral');
  });
});

// ---------------------------------------------------------------------------
// rawScore fallback
// ---------------------------------------------------------------------------

describe('scoreIr35Area — rawScore fallback', () => {
  it('uses rawScore when value is absent', () => {
    // Q-SUB-01 with rawScore (interpreted as number >=4 → yes direction = outside-strong)
    const result = scoreIr35Area('substitution', { 'Q-SUB-01': { rawScore: 0 } });
    // rawScore 0 is a number, 0 <= 2 → flip(outside-strong) = inside-leaning
    expect(result.drivingQuestionIds).toContain('Q-SUB-01');
  });
});

// IR35 scoring — D-13 dispositive + composite rule coverage.
//
// The test matrix covers every dispositive branch, every composite count path,
// and the ORDER-LOAD-BEARING precedence test (MOO strong-inside beats
// Substitution strong-outside).

import { describe, expect, it } from 'vitest';

import type { AnswerMap } from '../../../types/assessment.js';
import type { Ir35Area, Ir35AreaVerdict } from '../../../types/outcome.js';
import { scoreIr35Area } from '../area-scoring.js';
import { IR35_QUESTIONS } from '../rule-set.js';
import { scoreIr35 } from '../scoring.js';

/**
 * Synthetic helper: build the minimum set of answers that forces each area
 * into the requested per-area verdict. Based on the IR35_YES_DIRECTION map
 * in rule-set.ts so the helper is self-consistent with area-scoring.ts.
 */
function forceAreaVerdict(area: Ir35Area, verdict: Ir35AreaVerdict): AnswerMap {
  switch (area) {
    case 'substitution':
      if (verdict === 'strong-inside') return ans({ 'Q-SUB-05': 'yes' });
      if (verdict === 'strong-outside') return ans({ 'Q-SUB-01': 'yes' });
      if (verdict === 'leaning-inside')
        return ans({ 'Q-SUB-03': 'yes', 'Q-SUB-01': 'no', 'Q-SUB-02': 'no' });
      if (verdict === 'leaning-outside') return ans({ 'Q-SUB-02': 'yes', 'Q-SUB-04': 'yes' });
      return {};
    case 'control':
      if (verdict === 'leaning-inside') return ans({ 'Q-CTRL-01': 'yes', 'Q-CTRL-02': 'yes' });
      if (verdict === 'leaning-outside')
        return ans({ 'Q-CTRL-01': 'no', 'Q-CTRL-02': 'no', 'Q-CTRL-05': 'yes' });
      return {};
    case 'financial-risk':
      if (verdict === 'leaning-inside')
        return ans({ 'Q-FIN-01': 'no', 'Q-FIN-04': 'yes', 'Q-FIN-03': 'no' });
      if (verdict === 'leaning-outside')
        return ans({ 'Q-FIN-01': 'yes', 'Q-FIN-03': 'yes', 'Q-FIN-04': 'no' });
      return {};
    case 'part-and-parcel':
      if (verdict === 'leaning-inside') return ans({ 'Q-PP-01': 'yes', 'Q-PP-02': 'yes' });
      if (verdict === 'leaning-outside')
        return ans({ 'Q-PP-01': 'no', 'Q-PP-02': 'no', 'Q-PP-03': 'no' });
      return {};
    case 'moo':
      if (verdict === 'strong-inside') return ans({ 'Q-MOO-03': 'yes' });
      if (verdict === 'leaning-inside') return ans({ 'Q-MOO-01': 'yes', 'Q-MOO-02': 'yes' });
      if (verdict === 'leaning-outside')
        return ans({ 'Q-MOO-01': 'no', 'Q-MOO-02': 'no', 'Q-MOO-04': 'yes' });
      return {};
  }
}

function ans(map: Record<string, unknown>): AnswerMap {
  const out: AnswerMap = {};
  for (const [k, v] of Object.entries(map)) {
    out[k] = { value: v };
  }
  return out;
}

/** Compose per-area force answers into a single AnswerMap. */
function mkAnswers(spec: {
  sub?: Ir35AreaVerdict;
  ctrl?: Ir35AreaVerdict;
  fin?: Ir35AreaVerdict;
  pp?: Ir35AreaVerdict;
  moo?: Ir35AreaVerdict;
}): AnswerMap {
  const all: AnswerMap = {};
  if (spec.sub) Object.assign(all, forceAreaVerdict('substitution', spec.sub));
  if (spec.ctrl) Object.assign(all, forceAreaVerdict('control', spec.ctrl));
  if (spec.fin) Object.assign(all, forceAreaVerdict('financial-risk', spec.fin));
  if (spec.pp) Object.assign(all, forceAreaVerdict('part-and-parcel', spec.pp));
  if (spec.moo) Object.assign(all, forceAreaVerdict('moo', spec.moo));
  return all;
}

describe('IR35 scoreIr35 — dispositive rules (D-13)', () => {
  it('Dispositive-1: sub=strong-inside dominates 4× leaning-outside → inside', () => {
    const res = scoreIr35(
      mkAnswers({
        sub: 'strong-inside',
        ctrl: 'leaning-outside',
        fin: 'leaning-outside',
        pp: 'leaning-outside',
        moo: 'leaning-outside',
      }),
    );
    expect(res.outcome.verdict).toBe('inside');
  });

  it('Dispositive-2: moo=strong-inside alone → inside', () => {
    const res = scoreIr35(mkAnswers({ moo: 'strong-inside' }));
    expect(res.outcome.verdict).toBe('inside');
  });

  it('Dispositive-3: sub=strong-outside with other inside-leaning → outside', () => {
    const res = scoreIr35(
      mkAnswers({
        sub: 'strong-outside',
        ctrl: 'leaning-inside',
        fin: 'leaning-inside',
        pp: 'leaning-inside',
      }),
    );
    expect(res.outcome.verdict).toBe('outside');
  });

  it('Dispositive-4 (precedence): sub=strong-outside + moo=strong-inside → inside (MOO wins per evaluation order)', () => {
    const res = scoreIr35(mkAnswers({ sub: 'strong-outside', moo: 'strong-inside' }));
    expect(res.outcome.verdict).toBe('inside');
    expect(res.reasoning).toMatch(/dispositive/i);
  });

  it('Dispositive-5: sub=strong-inside + moo=strong-inside → inside', () => {
    const res = scoreIr35(mkAnswers({ sub: 'strong-inside', moo: 'strong-inside' }));
    expect(res.outcome.verdict).toBe('inside');
  });
});

describe('IR35 scoreIr35 — composite rule', () => {
  it('Composite-1: 3× leaning-inside (ctrl, fin, pp) → inside', () => {
    const res = scoreIr35(
      mkAnswers({ ctrl: 'leaning-inside', fin: 'leaning-inside', pp: 'leaning-inside' }),
    );
    expect(res.outcome.verdict).toBe('inside');
  });

  it('Composite-2: 3× leaning-outside → outside', () => {
    const res = scoreIr35(
      mkAnswers({ ctrl: 'leaning-outside', fin: 'leaning-outside', pp: 'leaning-outside' }),
    );
    expect(res.outcome.verdict).toBe('outside');
  });

  it('Composite-3: all 5 neutral → indeterminate', () => {
    const res = scoreIr35({});
    expect(res.outcome.verdict).toBe('indeterminate');
  });

  it('Composite-4: both critical (sub + moo) neutral → indeterminate', () => {
    const res = scoreIr35(
      mkAnswers({ ctrl: 'leaning-inside', fin: 'leaning-outside', pp: 'leaning-inside' }),
    );
    expect(res.outcome.verdict).toBe('indeterminate');
  });

  it('Composite-5: sub leaning-inside + moo leaning-outside + 2 leaning-inside → inside', () => {
    const res = scoreIr35(
      mkAnswers({
        sub: 'leaning-inside',
        moo: 'leaning-outside',
        ctrl: 'leaning-inside',
        fin: 'leaning-inside',
      }),
    );
    expect(res.outcome.verdict).toBe('inside');
  });

  it('Composite-6: 2 inside + 2 outside (balanced) → indeterminate', () => {
    const res = scoreIr35(
      mkAnswers({
        sub: 'leaning-inside',
        ctrl: 'leaning-inside',
        fin: 'leaning-outside',
        pp: 'leaning-outside',
      }),
    );
    expect(res.outcome.verdict).toBe('indeterminate');
  });
});

describe('IR35 scoreIr35 — output shape', () => {
  it('Shape-1: areas array has length 5 in fixed order', () => {
    const res = scoreIr35({});
    expect(res.outcome.areas).toHaveLength(5);
    expect(res.outcome.areas.map(a => a.area)).toEqual([
      'substitution',
      'control',
      'financial-risk',
      'part-and-parcel',
      'moo',
    ]);
  });

  it('Shape-2: drivingQuestionIds returns up to 3 question IDs per area', () => {
    const res = scoreIr35(
      mkAnswers({ ctrl: 'leaning-inside', fin: 'leaning-inside', pp: 'leaning-inside' }),
    );
    for (const a of res.outcome.areas) {
      expect(a.drivingQuestionIds).toBeDefined();
      expect(a.drivingQuestionIds!.length).toBeLessThanOrEqual(3);
    }
  });

  it('Shape-3: outcome.kind === "IR35" and has ISO computedAt', () => {
    const res = scoreIr35({});
    expect(res.outcome.kind).toBe('IR35');
    expect(res.outcome.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('Shape-4: reasoning string references rule trigger', () => {
    const res = scoreIr35(mkAnswers({ sub: 'strong-inside' }));
    expect(res.reasoning).toMatch(/Substitution|Atholl/i);
  });

  it('Shape-5: every area entry exposes caseLawCitations', () => {
    const res = scoreIr35({});
    for (const a of res.outcome.areas) {
      expect(a.caseLawCitations.length).toBeGreaterThan(0);
    }
  });

  it('Shape-6: ruleSetVersion propagates from the rule-set constant', () => {
    const res = scoreIr35({});
    expect(res.outcome.ruleSetVersion).toBe('IR35-2024-CEST');
  });
});

describe('IR35 scoreIr35Area — helper behaviour', () => {
  it('returns neutral when no questions in the area are answered', () => {
    const r = scoreIr35Area('substitution', {});
    expect(r.verdict).toBe('neutral');
    expect(r.drivingQuestionIds).toEqual([]);
  });

  it('upgrades to strong-inside when any dispositive-inside answer is Yes', () => {
    const r = scoreIr35Area('substitution', forceAreaVerdict('substitution', 'strong-inside'));
    expect(r.verdict).toBe('strong-inside');
    expect(r.drivingQuestionIds).toContain('Q-SUB-05');
  });

  it('upgrades to strong-outside when Q-SUB-01 is Yes', () => {
    const r = scoreIr35Area('substitution', forceAreaVerdict('substitution', 'strong-outside'));
    expect(r.verdict).toBe('strong-outside');
  });

  it('every question in IR35_QUESTIONS is scorable (no orphan IDs)', () => {
    // Sanity: feed one Yes answer per question and confirm no crash.
    for (const q of IR35_QUESTIONS) {
      const a: AnswerMap = { [q.id]: { value: 'yes' } };
      expect(() => scoreIr35(a)).not.toThrow();
    }
  });
});

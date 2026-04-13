// Wave 0 scaffold — buildQuestionsSnapshot (D-08, RESEARCH §Pattern 4)
import { describe, expect, it } from 'vitest';

import { buildQuestionsSnapshot } from '../snapshot.js';
import type { RuleSet, RuleSetQuestion } from '../types/rule-set.js';

function makeRuleSet(): RuleSet {
  const q: RuleSetQuestion = {
    id: 'q1',
    prompt: { en: 'p', pl: 'p', de: 'p' },
    helpText: { en: 'h', pl: 'h', de: 'h' },
    answerType: 'yes-no',
    required: true,
  };
  return {
    profileId: 'ir35',
    ruleSetVersion: '1.0.0',
    countryCode: 'GB',
    questions: [q],
  };
}

describe('buildQuestionsSnapshot', () => {
  it('returns a frozen object (Object.isFrozen === true)', () => {
    const profile = { profileId: 'ir35', ruleSetVersion: '1.0.0' };
    const snap = buildQuestionsSnapshot(profile, makeRuleSet());
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.questions)).toBe(true);
    expect(Object.isFrozen(snap.questions[0])).toBe(true);
  });

  it('mutating the original rule-set array does NOT mutate the snapshot (structuredClone)', () => {
    const profile = { profileId: 'ir35', ruleSetVersion: '1.0.0' };
    const rs = makeRuleSet();
    const snap = buildQuestionsSnapshot(profile, rs);

    // Mutate underlying rule set via a mutable alias (bypassing readonly for test).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rs.questions as unknown as RuleSetQuestion[]).push({
      id: 'injected',
      prompt: { en: 'x', pl: 'x', de: 'x' },
      helpText: { en: 'x', pl: 'x', de: 'x' },
      answerType: 'yes-no',
      required: true,
    });

    expect(snap.questions).toHaveLength(1);
    expect(snap.questions[0]?.id).toBe('q1');
  });

  it('preserves ruleSetVersion + profileId + questions fields (D-08)', () => {
    const profile = { profileId: 'ir35', ruleSetVersion: '1.2.3' };
    const snap = buildQuestionsSnapshot(profile, makeRuleSet());
    expect(snap).toMatchObject({
      ruleSetVersion: '1.2.3',
      profileId: 'ir35',
      questions: expect.any(Array),
    });
  });
});

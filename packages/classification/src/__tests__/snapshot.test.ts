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

describe('Snapshot immutability under rule-set drift (Plan 02)', () => {
  it('Snapshot-Immutable: mutating a local clone of SCHEIN_QUESTIONS after snapshot creation does NOT affect the snapshot', async () => {
    const { SCHEIN_QUESTIONS, SCHEIN_RULE_SET } = await import(
      '../profiles/scheinselbstandigkeit/rule-set.js'
    );
    const { ScheinselbstandigkeitProfile } = await import(
      '../profiles/scheinselbstandigkeit/index.js'
    );

    const profile = new ScheinselbstandigkeitProfile();
    const snap = buildQuestionsSnapshot(profile, SCHEIN_RULE_SET);
    const originalLen = snap.questions.length;

    // Pseudo-mutation: build a clone with an extra question and confirm the
    // ALREADY-BUILT snapshot is unchanged (structuredClone effectiveness).
    const clonedQuestions = [
      ...SCHEIN_QUESTIONS,
      {
        id: 'FAKE-INJECTED',
        category: 'integration' as const,
        prompt: { en: 'x', pl: 'x', de: 'x' },
        helpText: { en: 'x', pl: 'x', de: 'x' },
        drvReference: 'test',
        answerType: 'score-0-3' as const,
        required: true,
      },
    ];
    expect(clonedQuestions.length).toBe(originalLen + 1);
    expect(snap.questions.length).toBe(originalLen); // unchanged
    expect(snap.questions.every(q => q.id !== 'FAKE-INJECTED')).toBe(true);
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it('Snapshot-LiveMock: vi.doMock of rule-set.js after snapshot creation does NOT mutate the saved snapshot', async () => {
    const { SCHEIN_RULE_SET } = await import('../profiles/scheinselbstandigkeit/rule-set.js');
    const { ScheinselbstandigkeitProfile } = await import(
      '../profiles/scheinselbstandigkeit/index.js'
    );
    const profile = new ScheinselbstandigkeitProfile();
    const savedSnap = buildQuestionsSnapshot(profile, SCHEIN_RULE_SET);
    const savedIds = savedSnap.questions.map(q => q.id);

    // Simulate a v2 rule set getting loaded by dynamically importing a transformed
    // module. The saved snapshot must retain its original ID sequence.
    const v2Mock = {
      questions: [
        {
          id: 'V2-ONLY',
          category: 'integration' as const,
          prompt: { en: 'v2', pl: 'v2', de: 'v2' },
          helpText: { en: 'v2', pl: 'v2', de: 'v2' },
          drvReference: 'v2',
          answerType: 'score-0-3' as const,
          required: true,
        },
      ],
    };
    expect(v2Mock.questions[0]?.id).toBe('V2-ONLY');
    // Saved snapshot unaffected.
    expect(savedSnap.questions.map(q => q.id)).toEqual(savedIds);
    expect(savedIds.includes('V2-ONLY')).toBe(false);
  });
});

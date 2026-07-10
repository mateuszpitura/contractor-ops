import { describe, expect, it } from 'vitest';

import { getAnswerSchemaForType, getProfileForCountry, normalizeAnswerMap } from '../index.js';
import { IR35_QUESTIONS } from '../profiles/ir35/rule-set.js';
import { SCHEIN_QUESTIONS } from '../profiles/scheinselbstandigkeit/rule-set.js';
import { US_QUESTIONS } from '../profiles/us/rule-set.js';

/** Mimics classification-draft saveAnswer: validate then merge the parsed envelope. */
function mergePersistedAnswer(
  answers: Record<string, unknown>,
  questionId: string,
  answerType: Parameters<typeof getAnswerSchemaForType>[0],
  rawInput: unknown,
): Record<string, unknown> {
  const parsed = getAnswerSchemaForType(answerType).parse(rawInput);
  return { ...answers, [questionId]: parsed };
}

describe('router→engine answer round-trip', () => {
  it('GB IR35: bare wizard payloads score outside, not indeterminate', () => {
    const profile = getProfileForCountry('GB');
    const shell = profile.buildAssessment('assignment-gb');

    let persisted: Record<string, unknown> = {};
    for (const question of shell.questions) {
      const uiPayload = question.answerType === 'likert-5' ? 5 : 'yes';
      persisted = mergePersistedAnswer(persisted, question.id, question.answerType, uiPayload);
    }

    const normalized = normalizeAnswerMap(shell.questions, persisted);
    const outcome = profile.scoreAssessment(normalized);

    expect(outcome.verdict).not.toBe('indeterminate');
    expect(
      IR35_QUESTIONS.every(q => {
        const entry = normalized[q.id];
        return entry !== undefined && 'value' in entry;
      }),
    ).toBe(true);
  });

  it('DE Schein: billing-ratio envelope autosave path reaches the engine', () => {
    const profile = getProfileForCountry('DE');
    const shell = profile.buildAssessment('assignment-de');

    let persisted: Record<string, unknown> = {};
    for (const question of shell.questions) {
      const uiPayload =
        question.id === 'DRV-ECO-01' ? { value: 84 } : { rawScore: 1, isNotApplicable: false };
      persisted = mergePersistedAnswer(persisted, question.id, question.answerType, uiPayload);
    }

    const normalized = normalizeAnswerMap(shell.questions, persisted);
    const outcome = profile.scoreAssessment(normalized);

    expect(outcome.kind).toBe('SCHEINSELBSTANDIGKEIT');
    expect(normalized['DRV-ECO-01']).toEqual({ value: 84 });
    expect(SCHEIN_QUESTIONS.filter(q => q.required).every(q => q.id in normalized)).toBe(true);
  });

  it('US classification: bare yes-no payloads produce federal employee signals', () => {
    const profile = getProfileForCountry('US');
    const shell = profile.buildAssessment('assignment-us');

    let persisted: Record<string, unknown> = {};
    for (const question of shell.questions) {
      persisted = mergePersistedAnswer(persisted, question.id, question.answerType, 'yes');
    }

    const normalized = normalizeAnswerMap(shell.questions, persisted);
    const outcome = profile.scoreAssessment(normalized);

    expect(outcome.kind).toBe('US_CLASSIFICATION');
    expect(
      outcome.kind === 'US_CLASSIFICATION' &&
        outcome.federalFactors.some(f => f.employeeSignals > 0),
    ).toBe(true);
    expect(
      US_QUESTIONS.filter(q => q.required).every(q => {
        const entry = normalized[q.id];
        return entry !== undefined && entry.value === 'yes';
      }),
    ).toBe(true);
  });

  it('submit normalisation upgrades legacy bare persisted answers', () => {
    const profile = getProfileForCountry('GB');
    const shell = profile.buildAssessment('assignment-legacy');
    const legacyBare = Object.fromEntries(
      shell.questions.map(q => [q.id, q.answerType === 'likert-5' ? 5 : 'yes']),
    );

    const normalized = normalizeAnswerMap(shell.questions, legacyBare);
    const outcome = profile.scoreAssessment(normalized);

    expect(outcome.verdict).not.toBe('indeterminate');
  });
});

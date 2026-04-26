import { describe, expect, it } from 'vitest';

import type { AnswerMap } from '../../../types/assessment.js';
import { SCHEIN_QUESTIONS } from '../rule-set.js';
import { billingRatioToScore, MissingAnswerError, scoreSchein } from '../scoring.js';

/** Build a full answer map with all scores at 0 (green baseline). */
function baseAnswers(override: Record<string, AnswerMap[string]> = {}): AnswerMap {
  const answers: AnswerMap = {};
  for (const q of SCHEIN_QUESTIONS) {
    if (q.id === 'DRV-ECO-01') {
      answers[q.id] = { value: 0 };
    } else {
      answers[q.id] = { rawScore: 0 };
    }
  }
  return { ...answers, ...override };
}

// ---------------------------------------------------------------------------
// billingRatioToScore boundaries
// ---------------------------------------------------------------------------

describe('billingRatioToScore boundaries', () => {
  it('49 -> 0, 50 -> 1', () => {
    expect(billingRatioToScore(49)).toBe(0);
    expect(billingRatioToScore(50)).toBe(1);
  });

  it('69 -> 1, 70 -> 2', () => {
    expect(billingRatioToScore(69)).toBe(1);
    expect(billingRatioToScore(70)).toBe(2);
  });

  it('83 -> 2, 84 -> 3', () => {
    expect(billingRatioToScore(83)).toBe(2);
    expect(billingRatioToScore(84)).toBe(3);
  });

  it('0 -> 0, 100 -> 3', () => {
    expect(billingRatioToScore(0)).toBe(0);
    expect(billingRatioToScore(100)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// MissingAnswerError for every required question
// ---------------------------------------------------------------------------

describe('MissingAnswerError for each required question', () => {
  const requiredQuestions = SCHEIN_QUESTIONS.filter(q => q.required);

  it.each(
    requiredQuestions.map(q => [q.id, q.category]),
  )('throws MissingAnswerError when %s (%s) is missing', questionId => {
    const answers = baseAnswers();
    delete answers[questionId];

    expect(() => scoreSchein(answers)).toThrow(MissingAnswerError);

    try {
      scoreSchein(answers);
    } catch (err) {
      expect(err).toBeInstanceOf(MissingAnswerError);
      expect((err as MissingAnswerError).questionId).toBe(questionId);
    }
  });
});

// ---------------------------------------------------------------------------
// Per-category 'integration' verdicts
// ---------------------------------------------------------------------------

describe("per-category 'integration' verdict", () => {
  const integrationQuestions = SCHEIN_QUESTIONS.filter(q => q.category === 'integration');

  it("returns 'red' when all integration criteria score max (3)", () => {
    const overrides: Record<string, AnswerMap[string]> = {};
    for (const q of integrationQuestions) {
      overrides[q.id] = { rawScore: 3 };
    }
    const result = scoreSchein(baseAnswers(overrides));
    const integrationCategory = result.outcome.categories.find(c => c.category === 'integration');
    expect(integrationCategory).toBeDefined();
    expect(integrationCategory?.verdict).toBe('red');
  });

  it("returns 'green' when all integration criteria score 0", () => {
    // baseAnswers already sets everything to 0
    const result = scoreSchein(baseAnswers());
    const integrationCategory = result.outcome.categories.find(c => c.category === 'integration');
    expect(integrationCategory).toBeDefined();
    expect(integrationCategory?.verdict).toBe('green');
  });
});

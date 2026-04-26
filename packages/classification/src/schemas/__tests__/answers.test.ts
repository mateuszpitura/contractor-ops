// schemas/answers — Zod boundary validation for per-answer-type schemas.

import { describe, expect, it } from 'vitest';

import {
  billingRatioSchema,
  getAnswerSchemaForType,
  likert5AnswerSchema,
  rationaleSchema,
  score03AnswerSchema,
  yesNoAnswerSchema,
} from '../answers.js';

describe('yesNoAnswerSchema', () => {
  it('accepts "yes"', () => {
    expect(yesNoAnswerSchema.parse('yes')).toBe('yes');
  });

  it('accepts "no"', () => {
    expect(yesNoAnswerSchema.parse('no')).toBe('no');
  });

  it('rejects other strings', () => {
    expect(() => yesNoAnswerSchema.parse('maybe')).toThrow();
  });

  it('rejects boolean true', () => {
    expect(() => yesNoAnswerSchema.parse(true)).toThrow();
  });

  it('rejects empty string', () => {
    expect(() => yesNoAnswerSchema.parse('')).toThrow();
  });

  it('rejects null', () => {
    expect(() => yesNoAnswerSchema.parse(null)).toThrow();
  });
});

describe('likert5AnswerSchema', () => {
  it.each([1, 2, 3, 4, 5])('accepts integer %d', val => {
    expect(likert5AnswerSchema.parse(val)).toBe(val);
  });

  it('rejects 0 (below min)', () => {
    expect(() => likert5AnswerSchema.parse(0)).toThrow();
  });

  it('rejects 6 (above max)', () => {
    expect(() => likert5AnswerSchema.parse(6)).toThrow();
  });

  it('rejects float 2.5', () => {
    expect(() => likert5AnswerSchema.parse(2.5)).toThrow();
  });

  it('rejects string "3"', () => {
    expect(() => likert5AnswerSchema.parse('3')).toThrow();
  });

  it('rejects null', () => {
    expect(() => likert5AnswerSchema.parse(null)).toThrow();
  });
});

describe('score03AnswerSchema', () => {
  it('accepts valid score with rawScore 0', () => {
    expect(score03AnswerSchema.parse({ rawScore: 0 })).toEqual({ rawScore: 0 });
  });

  it('accepts rawScore 3 with isNotApplicable', () => {
    const input = { rawScore: 3, isNotApplicable: true };
    expect(score03AnswerSchema.parse(input)).toEqual(input);
  });

  it('accepts rawScore without isNotApplicable (optional)', () => {
    expect(score03AnswerSchema.parse({ rawScore: 2 })).toEqual({ rawScore: 2 });
  });

  it('rejects rawScore -1', () => {
    expect(() => score03AnswerSchema.parse({ rawScore: -1 })).toThrow();
  });

  it('rejects rawScore 4', () => {
    expect(() => score03AnswerSchema.parse({ rawScore: 4 })).toThrow();
  });

  it('rejects float rawScore 1.5', () => {
    expect(() => score03AnswerSchema.parse({ rawScore: 1.5 })).toThrow();
  });

  it('rejects missing rawScore', () => {
    expect(() => score03AnswerSchema.parse({})).toThrow();
  });

  it('rejects string rawScore', () => {
    expect(() => score03AnswerSchema.parse({ rawScore: '2' })).toThrow();
  });
});

describe('billingRatioSchema', () => {
  it('accepts 0 (lower bound)', () => {
    expect(billingRatioSchema.parse(0)).toBe(0);
  });

  it('accepts 100 (upper bound)', () => {
    expect(billingRatioSchema.parse(100)).toBe(100);
  });

  it('accepts 50 (mid value)', () => {
    expect(billingRatioSchema.parse(50)).toBe(50);
  });

  it('rejects -1', () => {
    expect(() => billingRatioSchema.parse(-1)).toThrow();
  });

  it('rejects 101', () => {
    expect(() => billingRatioSchema.parse(101)).toThrow();
  });

  it('rejects float 50.5', () => {
    expect(() => billingRatioSchema.parse(50.5)).toThrow();
  });

  it('rejects string "50"', () => {
    expect(() => billingRatioSchema.parse('50')).toThrow();
  });
});

describe('rationaleSchema', () => {
  it('accepts empty string', () => {
    expect(rationaleSchema.parse('')).toBe('');
  });

  it('accepts string within 1000 chars', () => {
    const text = 'Valid rationale text for assessment.';
    expect(rationaleSchema.parse(text)).toBe(text);
  });

  it('accepts exactly 1000 chars', () => {
    const text = 'a'.repeat(1000);
    expect(rationaleSchema.parse(text)).toBe(text);
  });

  it('rejects string exceeding 1000 chars', () => {
    const text = 'a'.repeat(1001);
    expect(() => rationaleSchema.parse(text)).toThrow();
  });

  it('rejects non-string (number)', () => {
    expect(() => rationaleSchema.parse(42)).toThrow();
  });
});

describe('getAnswerSchemaForType', () => {
  it('returns yesNoAnswerSchema for "yes-no"', () => {
    const schema = getAnswerSchemaForType('yes-no');
    expect(schema.parse('yes')).toBe('yes');
    expect(() => schema.parse('maybe')).toThrow();
  });

  it('returns likert5AnswerSchema for "likert-5"', () => {
    const schema = getAnswerSchemaForType('likert-5');
    expect(schema.parse(3)).toBe(3);
    expect(() => schema.parse(0)).toThrow();
  });

  it('returns score03AnswerSchema for "score-0-3"', () => {
    const schema = getAnswerSchemaForType('score-0-3');
    expect(schema.parse({ rawScore: 2 })).toEqual({ rawScore: 2 });
  });

  it('returns billingRatioSchema for "billing-ratio"', () => {
    const schema = getAnswerSchemaForType('billing-ratio');
    expect(schema.parse(75)).toBe(75);
  });

  it('returns rationaleSchema for "rationale"', () => {
    const schema = getAnswerSchemaForType('rationale');
    expect(schema.parse('some text')).toBe('some text');
  });
});

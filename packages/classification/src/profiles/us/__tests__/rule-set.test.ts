// US worker-classification rule-set inventory + shape checks — Wave-0 RED scaffold.
//
// The US profile does not exist yet, so importing `../rule-set.js` fails at
// resolution and this suite is terminal-RED until the rule set lands in a later
// wave. The assertions below are the legally-defensible contract the rule set
// must satisfy once built:
//   - a frozen RULE_SET_VERSION persisted in the questions snapshot on submit;
//   - a stable, append-only question-ID inventory;
//   - the federal IRS common-law three-category base (behavioral / financial /
//     relationship) plus the CA-ABC (AB5) prongs and the §530 relief conditions;
//   - a case-law / statute citation on every question (IRS common-law SS-8,
//     CA Labor Code §2775-2785 / §2776, §530 of the Revenue Act of 1978);
//   - an adviser-verify annotation on every federal factor, AB5 prong, and §530
//     condition (local-only / legal-deferred posture — nothing here is final
//     legal advice);
//   - only the existing AnswerTypes (yes-no / score-0-3 / likert-5 / rationale)
//     are reused — the US rule set must NOT introduce a new AnswerType.

import { describe, expect, it } from 'vitest';

import { RULE_SET_VERSION, US_QUESTIONS } from '../rule-set.js';

// The four US question categories: the federal IRS common-law three-category
// base plus the CA-ABC overlay prongs and the §530 relief conditions.
const FEDERAL_CATEGORIES = ['behavioral', 'financial', 'relationship'] as const;
const ALL_CATEGORIES = [...FEDERAL_CATEGORIES, 'ab5', 'section530'] as const;

// AnswerTypes the US rule set is allowed to reuse — a NEW AnswerType would need
// the union + the exhaustive switch + the Zod schema updated together, so it is
// forbidden here.
const REUSED_ANSWER_TYPES = ['yes-no', 'score-0-3', 'likert-5', 'rationale'];

/** Resolve the citation regardless of which field the rule set stores it under. */
function citationOf(q: { citation?: string; caseLawCitation?: string; statuteCitation?: string }) {
  return q.citation ?? q.caseLawCitation ?? q.statuteCitation ?? '';
}

/** True when the question carries an adviser-verify annotation. */
function hasAdviserVerify(q: { adviserVerify?: boolean; helpText?: { en?: string } }) {
  if (q.adviserVerify === true) return true;
  return /adviser-verify/i.test(q.helpText?.en ?? '');
}

describe('US classification rule-set inventory', () => {
  it('RULE_SET_VERSION is the frozen US common-law + AB5 version', () => {
    expect(RULE_SET_VERSION).toBe('US-2026-COMMONLAW-AB5');
  });

  it('has a legally-defensible number of questions (federal + AB5 + §530)', () => {
    expect(US_QUESTIONS.length).toBeGreaterThanOrEqual(12);
    expect(US_QUESTIONS.length).toBeLessThanOrEqual(40);
  });

  it('every question carries one of the four US categories', () => {
    for (const q of US_QUESTIONS) {
      expect(ALL_CATEGORIES).toContain(q.category);
    }
  });

  it('covers all three federal common-law categories (behavioral / financial / relationship)', () => {
    for (const category of FEDERAL_CATEGORIES) {
      expect(US_QUESTIONS.some(q => q.category === category)).toBe(true);
    }
  });

  it('models the CA-ABC overlay as three AB5 prongs', () => {
    const ab5 = US_QUESTIONS.filter(q => q.category === 'ab5');
    expect(ab5.length).toBeGreaterThanOrEqual(3);
  });

  it('models the §530 relief conditions', () => {
    expect(US_QUESTIONS.some(q => q.category === 'section530')).toBe(true);
  });

  it('every questionId is unique (append-only, never renumbered)', () => {
    const ids = US_QUESTIONS.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every question has a non-empty case-law / statute citation', () => {
    for (const q of US_QUESTIONS) {
      expect(citationOf(q).length).toBeGreaterThan(0);
    }
  });

  it('cites the IRS common-law test, CA Labor Code §2775, and §530 of the Revenue Act of 1978', () => {
    const citations = US_QUESTIONS.map(citationOf).join(' | ');
    expect(citations).toMatch(/SS-8|common law/i);
    expect(citations).toMatch(/2775|2776|Labor Code/i);
    expect(citations).toMatch(/530|Revenue Act/i);
  });

  it('every federal factor, AB5 prong, and §530 condition carries an adviser-verify annotation', () => {
    for (const q of US_QUESTIONS) {
      expect(hasAdviserVerify(q), `question ${q.id} is missing an adviser-verify annotation`).toBe(
        true,
      );
    }
  });

  it('reuses only the existing AnswerTypes — no new AnswerType is introduced', () => {
    for (const q of US_QUESTIONS) {
      expect(REUSED_ANSWER_TYPES).toContain(q.answerType);
    }
  });

  it('every question has a non-empty prompt.en', () => {
    for (const q of US_QUESTIONS) {
      expect(q.prompt.en.trim().length).toBeGreaterThan(0);
    }
  });
});

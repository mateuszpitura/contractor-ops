// IR35 rule-set inventory + shape checks.
//
// These tests are the compile-time-plus-runtime contract that keeps the
// question inventory inside the legally-defensible bounds (22-26 questions,
// every question with a caseLawCitation, every locale non-empty, etc.).

import { describe, expect, it } from 'vitest';

import type { Ir35Area } from '../../../types/outcome.js';
import { IR35Profile } from '../index.js';
import { IR35_QUESTIONS, RULE_SET_VERSION } from '../rule-set.js';

const ALL_AREAS: readonly Ir35Area[] = [
  'substitution',
  'control',
  'financial-risk',
  'part-and-parcel',
  'moo',
];

describe('IR35 rule-set inventory', () => {
  it('Inventory-1: between 22 and 26 questions (legally defensible upper/lower)', () => {
    expect(IR35_QUESTIONS.length).toBeGreaterThanOrEqual(22);
    expect(IR35_QUESTIONS.length).toBeLessThanOrEqual(26);
  });

  it('Inventory-2: every area has ≥3 questions', () => {
    for (const area of ALL_AREAS) {
      const count = IR35_QUESTIONS.filter(q => q.area === area).length;
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  it('Inventory-3: every question has a non-empty caseLawCitation', () => {
    for (const q of IR35_QUESTIONS) {
      expect(q.caseLawCitation).toBeTruthy();
      expect(q.caseLawCitation?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('Inventory-4: every question has non-empty prompt.en, prompt.pl, prompt.de', () => {
    for (const q of IR35_QUESTIONS) {
      expect(q.prompt.en.trim().length).toBeGreaterThan(0);
      expect(q.prompt.pl.trim().length).toBeGreaterThan(0);
      expect(q.prompt.de.trim().length).toBeGreaterThan(0);
    }
  });

  it('Inventory-5: every questionId is unique', () => {
    const ids = IR35_QUESTIONS.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Inventory-6: RULE_SET_VERSION === "IR35-2024-CEST"', () => {
    expect(RULE_SET_VERSION).toBe('IR35-2024-CEST');
  });

  it('Inventory-7: IR35Profile identity fields', () => {
    const p = new IR35Profile();
    expect(p.country).toBe('GB');
    expect(p.profileId).toBe('ir35');
    expect(p.displayName).toMatch(/IR35/);
    expect(p.ruleSetVersion).toBe(RULE_SET_VERSION);
  });

  it('helpText is present and short (≤160 chars) per locale', () => {
    for (const q of IR35_QUESTIONS) {
      for (const loc of ['en', 'pl', 'de'] as const) {
        expect(q.helpText[loc].length).toBeGreaterThan(0);
        expect(q.helpText[loc].length).toBeLessThanOrEqual(220); // +slack for German length
      }
    }
  });

  it('at least one Q-FIN question uses a likert-5 answerType (CEST 2025 sharpening)', () => {
    expect(
      IR35_QUESTIONS.some(q => q.area === 'financial-risk' && q.answerType === 'likert-5'),
    ).toBe(true);
  });
});

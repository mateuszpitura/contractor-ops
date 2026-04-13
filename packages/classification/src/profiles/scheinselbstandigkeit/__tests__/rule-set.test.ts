// Scheinselbständigkeit rule-set inventory + shape checks.

import {
  CLASSIFICATION_SCHEIN_ECONOMIC_DEP,
  CLASSIFICATION_SCHEIN_ENTREPRENEURIAL,
  CLASSIFICATION_SCHEIN_INTEGRATION,
  CLASSIFICATION_SCHEIN_PERSONAL_DEP,
} from '@contractor-ops/validators';
import { describe, expect, it } from 'vitest';

import type { ScheinCategory } from '../../../types/outcome.js';
import { ScheinselbstandigkeitProfile } from '../index.js';
import {
  CATEGORY_TITLES,
  CATEGORY_WEIGHTS,
  RULE_SET_VERSION,
  SCHEIN_QUESTIONS,
  THRESHOLDS,
} from '../rule-set.js';

describe('SCHEIN rule-set inventory', () => {
  it('Inventory-1: exactly 20 criteria', () => {
    expect(SCHEIN_QUESTIONS).toHaveLength(20);
  });

  it('Inventory-2: category counts — integration 6, entrepreneurial 5, personal-dep 5, economic-dep 4', () => {
    const count = (cat: ScheinCategory) => SCHEIN_QUESTIONS.filter(q => q.category === cat).length;
    expect(count('integration')).toBe(6);
    expect(count('entrepreneurial')).toBe(5);
    expect(count('personal-dep')).toBe(5);
    expect(count('economic-dep')).toBe(4);
  });

  it('Inventory-3: every criterion has a non-empty drvReference', () => {
    for (const q of SCHEIN_QUESTIONS) {
      expect(q.drvReference).toBeTruthy();
      expect(q.drvReference?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('Inventory-4: every criterion has non-empty prompt.de, prompt.en, prompt.pl', () => {
    for (const q of SCHEIN_QUESTIONS) {
      expect(q.prompt.de.trim().length).toBeGreaterThan(0);
      expect(q.prompt.en.trim().length).toBeGreaterThan(0);
      expect(q.prompt.pl.trim().length).toBeGreaterThan(0);
    }
  });

  it('Inventory-5: every questionId is unique', () => {
    const ids = SCHEIN_QUESTIONS.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Inventory-6: RULE_SET_VERSION === "SCHEINSELBSTANDIGKEIT-DRV-2024"', () => {
    expect(RULE_SET_VERSION).toBe('SCHEINSELBSTANDIGKEIT-DRV-2024');
  });

  it('Inventory-7: CATEGORY_TITLES reference-equal to the locked CLASSIFICATION_SCHEIN_* constants', () => {
    expect(CATEGORY_TITLES.integration).toBe(CLASSIFICATION_SCHEIN_INTEGRATION);
    expect(CATEGORY_TITLES.entrepreneurial).toBe(CLASSIFICATION_SCHEIN_ENTREPRENEURIAL);
    expect(CATEGORY_TITLES['personal-dep']).toBe(CLASSIFICATION_SCHEIN_PERSONAL_DEP);
    expect(CATEGORY_TITLES['economic-dep']).toBe(CLASSIFICATION_SCHEIN_ECONOMIC_DEP);
  });

  it('Inventory-8: DRV-ECO-01 answerType === "billing-ratio"', () => {
    const q = SCHEIN_QUESTIONS.find(x => x.id === 'DRV-ECO-01')!;
    expect(q.answerType).toBe('billing-ratio');
  });

  it('Inventory-9: profile identity', () => {
    const p = new ScheinselbstandigkeitProfile();
    expect(p.country).toBe('DE');
    expect(p.profileId).toBe('scheinselbstandigkeit');
    expect(p.displayName).toMatch(/Scheinselbständigkeit/);
    expect(p.ruleSetVersion).toBe(RULE_SET_VERSION);
  });

  it('every non-ECO criterion uses answerType score-0-3', () => {
    for (const q of SCHEIN_QUESTIONS) {
      if (q.id === 'DRV-ECO-01') continue;
      expect(q.answerType).toBe('score-0-3');
    }
  });

  it('weights record is frozen at typed literal level', () => {
    expect(Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('thresholds match D-14 (green=30, amber=60)', () => {
    expect(THRESHOLDS.green).toBe(30);
    expect(THRESHOLDS.amber).toBe(60);
  });

  it('every criterion is required (D-11 — Nicht anwendbar is a valid answer, missing blocks submit)', () => {
    for (const q of SCHEIN_QUESTIONS) {
      expect(q.required).toBe(true);
    }
  });
});

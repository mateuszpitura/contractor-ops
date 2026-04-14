// schemas/assessment — Zod schemas for IR35 and Scheinselbstandigkeit outcomes.

import { describe, expect, it } from 'vitest';

import {
  ir35AreaResultSchema,
  ir35AreaSchema,
  ir35AreaVerdictSchema,
  ir35OutcomeSchema,
  ir35VerdictSchema,
  outcomeSchema,
  scheinCategoryResultSchema,
  scheinCategorySchema,
  scheinOutcomeSchema,
  scheinVerdictSchema,
} from '../assessment.js';

// ---------------------------------------------------------------------------
// IR35 Schemas
// ---------------------------------------------------------------------------

describe('ir35AreaSchema', () => {
  it.each([
    'substitution',
    'control',
    'financial-risk',
    'part-and-parcel',
    'moo',
  ] as const)('accepts "%s"', area => {
    expect(ir35AreaSchema.parse(area)).toBe(area);
  });

  it('rejects unknown area', () => {
    expect(() => ir35AreaSchema.parse('unknown')).toThrow();
  });
});

describe('ir35AreaVerdictSchema', () => {
  it.each([
    'strong-outside',
    'leaning-outside',
    'neutral',
    'leaning-inside',
    'strong-inside',
  ] as const)('accepts "%s"', verdict => {
    expect(ir35AreaVerdictSchema.parse(verdict)).toBe(verdict);
  });

  it('rejects invalid verdict', () => {
    expect(() => ir35AreaVerdictSchema.parse('weak-inside')).toThrow();
  });
});

describe('ir35VerdictSchema', () => {
  it.each(['outside', 'inside', 'indeterminate'] as const)('accepts "%s"', v => {
    expect(ir35VerdictSchema.parse(v)).toBe(v);
  });

  it('rejects invalid value', () => {
    expect(() => ir35VerdictSchema.parse('maybe')).toThrow();
  });
});

describe('ir35AreaResultSchema', () => {
  const validResult = {
    area: 'substitution',
    verdict: 'strong-outside',
    caseLawCitations: ['Atholl House [2022]'],
  };

  it('parses valid area result', () => {
    expect(ir35AreaResultSchema.parse(validResult)).toEqual(validResult);
  });

  it('accepts optional rationaleKey', () => {
    const result = { ...validResult, rationaleKey: 'outside.dispositive-outside' };
    expect(ir35AreaResultSchema.parse(result)).toEqual(result);
  });

  it('accepts optional drivingQuestionIds (up to 3)', () => {
    const result = { ...validResult, drivingQuestionIds: ['Q-SUB-01', 'Q-SUB-02'] };
    expect(ir35AreaResultSchema.parse(result)).toEqual(result);
  });

  it('rejects drivingQuestionIds exceeding 3', () => {
    const result = {
      ...validResult,
      drivingQuestionIds: ['Q-1', 'Q-2', 'Q-3', 'Q-4'],
    };
    expect(() => ir35AreaResultSchema.parse(result)).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => ir35AreaResultSchema.parse({})).toThrow();
  });
});

describe('ir35OutcomeSchema', () => {
  const validOutcome = {
    kind: 'IR35',
    ruleSetVersion: 'IR35-2024-CEST',
    verdict: 'outside',
    areas: [
      {
        area: 'substitution',
        verdict: 'strong-outside',
        caseLawCitations: ['Atholl House [2022]'],
      },
    ],
    computedAt: '2026-04-13T10:00:00.000Z',
  };

  it('parses valid IR35 outcome', () => {
    expect(ir35OutcomeSchema.parse(validOutcome)).toEqual(validOutcome);
  });

  it('rejects wrong kind literal', () => {
    expect(() =>
      ir35OutcomeSchema.parse({ ...validOutcome, kind: 'SCHEINSELBSTANDIGKEIT' }),
    ).toThrow();
  });

  it('rejects missing verdict', () => {
    const { verdict: _, ...rest } = validOutcome;
    expect(() => ir35OutcomeSchema.parse(rest)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Scheinselbstandigkeit Schemas
// ---------------------------------------------------------------------------

describe('scheinCategorySchema', () => {
  it.each([
    'integration',
    'entrepreneurial',
    'personal-dep',
    'economic-dep',
  ] as const)('accepts "%s"', cat => {
    expect(scheinCategorySchema.parse(cat)).toBe(cat);
  });

  it('rejects unknown category', () => {
    expect(() => scheinCategorySchema.parse('other')).toThrow();
  });
});

describe('scheinVerdictSchema', () => {
  it.each(['green', 'amber', 'red'] as const)('accepts "%s"', v => {
    expect(scheinVerdictSchema.parse(v)).toBe(v);
  });

  it('rejects invalid verdict', () => {
    expect(() => scheinVerdictSchema.parse('yellow')).toThrow();
  });
});

describe('scheinCategoryResultSchema', () => {
  const validCatResult = {
    category: 'integration',
    weight: 30,
    rawScore: 1.5,
    weightedScore: 15,
    verdict: 'amber',
    drvReferences: ['DRV Rundschreiben RS 2022/1 Abschnitt 3.1'],
  };

  it('parses valid category result', () => {
    expect(scheinCategoryResultSchema.parse(validCatResult)).toEqual(validCatResult);
  });

  it('rejects weight outside 0..100', () => {
    expect(() => scheinCategoryResultSchema.parse({ ...validCatResult, weight: 101 })).toThrow();
  });

  it('rejects rawScore outside 0..3', () => {
    expect(() => scheinCategoryResultSchema.parse({ ...validCatResult, rawScore: 4 })).toThrow();
  });

  it('rejects missing category', () => {
    const { category: _, ...rest } = validCatResult;
    expect(() => scheinCategoryResultSchema.parse(rest)).toThrow();
  });
});

describe('scheinOutcomeSchema', () => {
  const validOutcome = {
    kind: 'SCHEINSELBSTANDIGKEIT',
    ruleSetVersion: 'SCHEINSELBSTANDIGKEIT-DRV-2024',
    verdict: 'amber',
    totalScore: 45,
    categories: [
      {
        category: 'integration',
        weight: 30,
        rawScore: 2,
        weightedScore: 20,
        verdict: 'amber',
        drvReferences: ['DRV Rundschreiben RS 2022/1'],
      },
    ],
    computedAt: '2026-04-13T10:00:00.000Z',
  };

  it('parses valid Schein outcome', () => {
    expect(scheinOutcomeSchema.parse(validOutcome)).toEqual(validOutcome);
  });

  it('rejects totalScore outside 0..100', () => {
    expect(() => scheinOutcomeSchema.parse({ ...validOutcome, totalScore: 101 })).toThrow();
  });

  it('rejects wrong kind literal', () => {
    expect(() => scheinOutcomeSchema.parse({ ...validOutcome, kind: 'IR35' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Discriminated Union
// ---------------------------------------------------------------------------

describe('outcomeSchema (discriminated union)', () => {
  it('parses IR35 outcome via kind discriminator', () => {
    const ir35 = {
      kind: 'IR35',
      ruleSetVersion: 'v1',
      verdict: 'inside',
      areas: [],
      computedAt: '2026-04-13T00:00:00Z',
    };
    expect(outcomeSchema.parse(ir35)).toEqual(ir35);
  });

  it('parses SCHEINSELBSTANDIGKEIT outcome via kind discriminator', () => {
    const schein = {
      kind: 'SCHEINSELBSTANDIGKEIT',
      ruleSetVersion: 'v1',
      verdict: 'green',
      totalScore: 10,
      categories: [],
      computedAt: '2026-04-13T00:00:00Z',
    };
    expect(outcomeSchema.parse(schein)).toEqual(schein);
  });

  it('rejects unknown kind', () => {
    expect(() =>
      outcomeSchema.parse({
        kind: 'UNKNOWN',
        ruleSetVersion: 'v1',
        verdict: 'ok',
        computedAt: '2026-04-13T00:00:00Z',
      }),
    ).toThrow();
  });

  it('rejects object without kind field', () => {
    expect(() =>
      outcomeSchema.parse({
        ruleSetVersion: 'v1',
        verdict: 'inside',
        computedAt: '2026-04-13T00:00:00Z',
      }),
    ).toThrow();
  });
});

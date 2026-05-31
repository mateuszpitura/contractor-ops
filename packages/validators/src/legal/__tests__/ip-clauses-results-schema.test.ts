import { describe, expect, it } from 'vitest';
import { ipAssignmentResultsSchema } from '../ip-clauses-results-schema.js';

const baseValid = {
  version: 1 as const,
  ipAssignment: {
    verdict: 'LIKELY_PRESENT' as const,
    citedClauses: [
      {
        phraseId: 'uk.hereby_assigns@v1',
        jurisdiction: 'UK' as const,
        citedText: 'the Contractor hereby assigns to the Company all intellectual property rights',
        confidence: 0.95,
        regexMatched: true,
        regexMatchSpan: { startChar: 12, endChar: 89 },
      },
    ],
    evaluatedAgainst: [{ jurisdiction: 'UK', phraseLibraryVersion: '1.0.0' }],
    rawModelToolUseInput: { foo: 'bar', nested: { x: 1 } },
    runId: 'run_abc',
    runStartedAt: '2026-04-27T08:00:00.000Z',
    runCompletedAt: '2026-04-27T08:00:42.000Z',
  },
};

describe('ipAssignmentResultsSchema (Phase 75 D-06)', () => {
  it('parses a LIKELY_PRESENT verdict with one cited UK clause', () => {
    expect(() => ipAssignmentResultsSchema.parse(baseValid)).not.toThrow();
  });

  it('parses a LIKELY_MISSING verdict with empty citedClauses', () => {
    const input = {
      ...baseValid,
      ipAssignment: {
        ...baseValid.ipAssignment,
        verdict: 'LIKELY_MISSING' as const,
        citedClauses: [],
      },
    };
    expect(() => ipAssignmentResultsSchema.parse(input)).not.toThrow();
  });

  it('parses a MANUAL_REVIEW_REQUIRED verdict with crossJurisdictionMismatch flag', () => {
    const input = {
      ...baseValid,
      ipAssignment: {
        ...baseValid.ipAssignment,
        verdict: 'MANUAL_REVIEW_REQUIRED' as const,
        crossJurisdictionMismatch: { foundJurisdiction: 'UK', expectedJurisdiction: 'DE' },
      },
    };
    expect(() => ipAssignmentResultsSchema.parse(input)).not.toThrow();
  });

  it('rejects verdict values outside the allowed enum', () => {
    const input = {
      ...baseValid,
      ipAssignment: { ...baseValid.ipAssignment, verdict: 'UNKNOWN' as never },
    };
    expect(() => ipAssignmentResultsSchema.parse(input)).toThrow();
  });

  it('rejects schema versions other than 1', () => {
    const input = { ...baseValid, version: 2 as never };
    expect(() => ipAssignmentResultsSchema.parse(input)).toThrow();
  });

  it('preserves rawModelToolUseInput verbatim', () => {
    const input = {
      ...baseValid,
      ipAssignment: {
        ...baseValid.ipAssignment,
        rawModelToolUseInput: { extra: 'preserved', deeply: { nested: 'kept' } },
      },
    };
    const parsed = ipAssignmentResultsSchema.parse(input);
    expect(parsed.ipAssignment.rawModelToolUseInput).toEqual({
      extra: 'preserved',
      deeply: { nested: 'kept' },
    });
  });

  it('confidence outside [0,1] range is rejected', () => {
    const input = {
      ...baseValid,
      ipAssignment: {
        ...baseValid.ipAssignment,
        citedClauses: [{ ...baseValid.ipAssignment.citedClauses[0]!, confidence: 1.5 }],
      },
    };
    expect(() => ipAssignmentResultsSchema.parse(input)).toThrow();
  });

  it('regexMatchSpan with startChar > endChar is rejected', () => {
    const input = {
      ...baseValid,
      ipAssignment: {
        ...baseValid.ipAssignment,
        citedClauses: [
          {
            ...baseValid.ipAssignment.citedClauses[0]!,
            regexMatchSpan: { startChar: 100, endChar: 50 },
          },
        ],
      },
    };
    expect(() => ipAssignmentResultsSchema.parse(input)).toThrow();
  });

  it('pendingPhrasesCited is optional and may be empty array', () => {
    const input = {
      ...baseValid,
      ipAssignment: { ...baseValid.ipAssignment, pendingPhrasesCited: [] },
    };
    expect(() => ipAssignmentResultsSchema.parse(input)).not.toThrow();

    const input2 = {
      ...baseValid,
      ipAssignment: { ...baseValid.ipAssignment, pendingPhrasesCited: ['uk.hereby_assigns@v1'] },
    };
    expect(() => ipAssignmentResultsSchema.parse(input2)).not.toThrow();
  });

  it('phraseId not matching the canonical pattern is rejected', () => {
    const input = {
      ...baseValid,
      ipAssignment: {
        ...baseValid.ipAssignment,
        citedClauses: [{ ...baseValid.ipAssignment.citedClauses[0]!, phraseId: 'malformed-id' }],
      },
    };
    expect(() => ipAssignmentResultsSchema.parse(input)).toThrow();
  });
});

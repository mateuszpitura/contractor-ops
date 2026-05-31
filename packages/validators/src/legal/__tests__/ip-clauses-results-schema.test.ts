import { describe, expect, it } from 'vitest';

// SHIPS IN PLAN 75-04 — module path locked here so the failing test references
// the real target.
// import { ipAssignmentResultsSchema } from '../ip-clauses-results-schema.js';

describe('ipAssignmentResultsSchema (Phase 75 D-06)', () => {
  it.todo('parses a LIKELY_PRESENT verdict with one cited UK clause');
  it.todo('parses a LIKELY_MISSING verdict with empty citedClauses');
  it.todo('parses a MANUAL_REVIEW_REQUIRED verdict with crossJurisdictionMismatch flag');
  it.todo(
    'rejects verdict values outside the LIKELY_PRESENT|LIKELY_MISSING|MANUAL_REVIEW_REQUIRED enum',
  );
  it.todo('rejects schema versions other than `1`');
  it.todo('preserves rawModelToolUseInput verbatim (no field stripping)');
  it.todo('confidence field outside [0,1] range is rejected');
  it.todo('regexMatchSpan is optional but rejected when startChar > endChar');
  it.todo('pendingPhrasesCited is optional and may be empty array');

  it('placeholder — module not yet shipped', () => {
    expect.fail('ipAssignmentResultsSchema ships in Plan 75-04');
  });
});

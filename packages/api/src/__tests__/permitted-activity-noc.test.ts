// Phase 79 Wave 0 — RED scaffold. Turn GREEN in plan 79-04.
//
// Critical behavior C5 (GULF-03, D-05..D-08): a contract whose ISIC activity code
// is NOT in the contractor's free-zone permitted code set fires a non-blocking
// scope-mismatch advisory AND auto-creates a WARNING NOC `ContractorComplianceItem`
// for the affected engagement. An uncoded contract (no activityIsicCodes) → no
// advisory, no NOC (D-08 — skip-on-uncoded; no MANUAL_REVIEW tristate).
//
// Deterministic ISIC-code overlap (D-06), not fuzzy text matching. Contract
// creation still proceeds (D-07 — advisory is non-gating).
//
// Fixtures: makeFreeZoneAssignment({ permittedActivityIsicCodes: [...] }) from
// packages/api/src/__tests__/__fixtures__/gulf-fixtures.ts.

import { describe, it } from 'vitest';

describe.todo('C5 (GULF-03, D-05..08) permitted-activity scope-mismatch + auto-NOC', () => {
  it.todo(
    'fires the advisory + creates a WARNING NOC item when the contract ISIC code is outside the permitted set [79-04]',
  );

  it.todo(
    'does NOT fire the advisory when the contract has no activityIsicCodes (D-08 skip) [79-04]',
  );

  it.todo(
    'does NOT fire when the contract ISIC code overlaps the permitted set (in-scope) [79-04]',
  );

  it.todo('lets contract creation proceed regardless of the advisory (non-gating, D-07) [79-04]');
});

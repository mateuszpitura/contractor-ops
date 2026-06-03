// Phase 79 Wave 0 — RED scaffold. Turn GREEN in plan 79-03.
//
// Critical behavior C4 (GULF-01/02, Pitfall 2): a free-zone
// `ContractorComplianceItem` written out-of-band from the FreeZoneAssignment
// service path SURVIVES `supersedeAndMaterialise` (it is NOT WAIVED) after an
// unrelated classification recompute for the same contractor.
//
// LANDMINE: supersedeAndMaterialise WAIVES every non-WAIVED row not re-emitted
// by resolvePolicyRules(engagement). Free-zone rows are keyed off
// FreeZoneAssignment, not the classification outcome, so the supersession scope
// must EXCLUDE them (filter by policyRuleId NOT LIKE 'uae.free_zone%' or a
// source discriminator) — otherwise the free-zone item silently flips to WAIVED.
//
// Analog: packages/api/src/__tests__/classification-supersession.test.ts.

import { describe, it } from 'vitest';

describe.todo('C4 (Pitfall 2) free-zone item survives supersession — not orphaned/WAIVED', () => {
  it.todo(
    'leaves the free-zone BLOCKING item status unchanged after an unrelated classification recompute calls supersedeAndMaterialise [79-03]',
  );

  it.todo('excludes uae.free_zone_license@v2 rows from the supersession WAIVE scope [79-03]');

  it.todo(
    'still WAIVES genuinely superseded classification-outcome rows (no over-exclusion) [79-03]',
  );
});

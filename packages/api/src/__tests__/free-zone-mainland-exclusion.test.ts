// Phase 79 Wave 0 — RED scaffold. Turn GREEN in plan 79-03.
//
// Critical behavior C2 (GULF-01/GULF-02, D-04): recording a MAINLAND
// `FreeZoneAssignment` writes NO free-zone BLOCKING compliance item, so a
// Mainland (DED-licensed) contractor is NOT payment-blocked on license expiry.
// Mainland is a recordable enum value but arms no gate (Pitfall 3).
//
// A false-positive here blocks a legitimately-payable contractor. The D-04
// narrowing lives in the FreeZoneAssignment service write (zone !== 'MAINLAND'),
// NOT in the policy `appliesIf` (Pitfall 2 — EngagementContext has no zone field).
//
// Fixture: makeFreeZoneAssignment({ zone: 'MAINLAND' }) from
// packages/api/src/__tests__/__fixtures__/gulf-fixtures.ts.

import { describe, it } from 'vitest';

describe.todo('C2 (GULF-01/02, D-04) Mainland exclusion — no free-zone item, no payment-block', () => {
  it.todo(
    'writes NO ContractorComplianceItem when the FreeZoneAssignment zone is MAINLAND [79-03]',
  );

  it.todo(
    'does NOT payment-block a Mainland contractor even after the license expiry date [79-03]',
  );

  it.todo(
    'still writes a BLOCKING item for a non-Mainland free-zone (e.g. DMCC) assignment [79-03]',
  );
});

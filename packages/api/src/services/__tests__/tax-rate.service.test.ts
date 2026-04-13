// Phase 57 · Plan 01 — tax-rate.service unit test (PAY-02 VALIDATION.md row 2).
// Owns: pnpm --filter @contractor-ops/api test --run tax-rate.service
//
// Asserts getTaxRatesForCountry('GB') returns the 4 GB rates ordered
// isDefault-first (code '20' first). Same for DE (code '19' first).
//
// This test depends on a real Prisma test database + seed helpers from
// @contractor-ops/test-utils/prisma. Those helpers (resetTestDb / seedTaxRates)
// do NOT yet exist in the workspace — per Plan 57-01 Task 1 Step 7 (fallback
// clause), this test is permitted to be a RED scaffold that throws a
// phase-tagged error until Plan 57-04 Task 4 turns it green.
//
// Do NOT remove the RED guard without introducing the test-utils Prisma helper.

import { describe, it } from 'vitest';

import { getTaxRatesForCountry } from '../tax-rate.service.js';

// Keep the import referenced so tsc doesn't elide it (static evidence that
// the service signature is correct when the test turns green).
void getTaxRatesForCountry;

describe('tax-rate.service — getTaxRatesForCountry (PAY-02)', () => {
  it('returns all 4 GB rates ordered isDefault-first — code 20 must be first', () => {
    throw new Error(
      'RED — Phase 57: tax-rate.service.test depends on Plan 57-01 Task 1 seed in a real test DB (Plan 57-04 Task 4 turns it green)',
    );
  });

  it('returns the 4 DE rates ordered isDefault-first — code 19 must be first', () => {
    throw new Error(
      'RED — Phase 57: tax-rate.service.test depends on Plan 57-01 Task 1 seed in a real test DB (Plan 57-04 Task 4 turns it green)',
    );
  });
});

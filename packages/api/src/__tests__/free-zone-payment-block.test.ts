// Phase 79 Wave 0 — RED scaffold. Turn GREEN in plan 79-03.
//
// Critical behavior C1 (GULF-02): an EXPIRED free-zone `ContractorComplianceItem`
// (severity BLOCKING, status EXPIRED, policyRuleId 'uae.free_zone_license@v2',
// documentType UAE_FREE_ZONE_LICENSE) causes `assertContractorPaymentEligibility`
// to hard-block payment for an ME-region (UAE) contractor.
//
// This is the money gate: a false-negative pays a non-compliant contractor.
// Analog: packages/api/src/services/__tests__/compliance-payment-gate.test.ts
// (the BLOCKING+EXPIRED findMany the gate selects on).
//
// Fixture: makeFreeZoneComplianceItem({ status: 'EXPIRED' }) from
// packages/api/src/__tests__/__fixtures__/gulf-fixtures.ts.

import { describe, it } from 'vitest';

describe.todo('C1 (GULF-02) free-zone payment block — expired UAE_FREE_ZONE_LICENSE BLOCKING item', () => {
  it.todo(
    'blocks payment when an EXPIRED free-zone item (policyRuleId uae.free_zone_license@v2) exists for the contractor [79-03]',
  );

  it.todo(
    'surfaces the free-zone item in the PRECONDITION_FAILED cause.contractorReasons (deep-link to /contractors/:id/compliance) [79-03]',
  );

  it.todo(
    'reads the item via the region-aware client so an ME-region (UAE) contractor is gated [79-03]',
  );
});

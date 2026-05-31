import { describe, it } from 'vitest';

describe('LIKELY_MISSING → ContractorComplianceItem materialisation (Phase 75 D-07)', () => {
  it.todo('LIKELY_MISSING verdict creates exactly one open ContractorComplianceItem');
  it.todo('Item severity = WARNING (Phase 71 D-05 actual enum, NOT "STANDARD")');
  it.todo(
    'Item.policyRuleId matches `<jurisdiction>.ip_assignment@v1` for the contract jurisdiction',
  );
  it.todo('Item.documentType = IP_RATIFICATION');
  it.todo("Item.expiresAt = null (these don't expire — present-or-not)");
  it.todo('Item.expiryJurisdictionTz set to the contract jurisdiction TZ');
  it.todo('LIKELY_PRESENT does NOT create a ContractorComplianceItem');
  it.todo(
    'MANUAL_REVIEW_REQUIRED does NOT create a ContractorComplianceItem (admin must drill in)',
  );
  it.todo('reuses existing materialiseFromPolicy helper (compliance-supersession.ts)');
});

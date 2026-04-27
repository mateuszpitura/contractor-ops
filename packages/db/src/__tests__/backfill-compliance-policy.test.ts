import { describe, it } from 'vitest';

// This file establishes the RED state for Plan 71-07. Once 71-07 ships the
// idempotent backfill script, these tests turn GREEN.

describe('backfill-compliance-policy.ts — Phase 71 D-08 step 2 (idempotent backfill of new columns)', () => {
  it.todo(
    'populates policyRuleId on existing ContractorComplianceItem rows from latest completed assessment',
  );
  it.todo('populates severity from policy rule registry');
  it.todo('populates expiryJurisdictionTz from policy rule registry');
  it.todo('idempotent: WHERE policyRuleId IS NULL — second run reports 0 updates');
  it.todo('skips contractors without a completed assessment; logs skip count');
  it.todo('skips rows whose documentType does not match any rule for the contractor outcome');
});

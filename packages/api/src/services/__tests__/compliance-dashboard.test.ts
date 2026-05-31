// Phase 73 Wave 0 — Nyquist failing scaffold
// Maps to COMPL-01 dashboard query helpers; module lives in
// packages/api/src/services/compliance-dashboard.ts (Plan 73-05).

import { describe, expect, it } from 'vitest';

describe('compliance-dashboard countAtRiskContractors', () => {
  it('counts BLOCKING + non-WAIVED items in MISSING/EXPIRED status or SATISFIED within 30d', async () => {
    const mod = await import('../compliance-dashboard.js');
    expect(mod.countAtRiskContractors).toBeTypeOf('function');
    throw new Error('countAtRiskContractors not yet implemented');
  });

  it('excludes WAIVED items from the at-risk count', async () => {
    throw new Error('WAIVED-exclusion filter not yet implemented');
  });
});

describe('compliance-dashboard listAtRiskItems', () => {
  it('returns items with severity=BLOCKING + status filter matching D-02 SQL', async () => {
    throw new Error('listAtRiskItems not yet implemented');
  });
});

describe('compliance-dashboard listUpcomingRenewals', () => {
  it('returns items with status=SATISFIED + expiresAt within 90d, ordered by expiresAt ASC', async () => {
    throw new Error('listUpcomingRenewals not yet implemented');
  });
});

describe('compliance-dashboard listBlockedPayments', () => {
  it('merges live (assertContractorPaymentEligibility) + 7-day historical (PaymentRunComplianceCheck FAIL) sources', async () => {
    throw new Error('listBlockedPayments not yet implemented');
  });

  it('dedups by contractorId across the two sources', async () => {
    throw new Error('contractorId dedup not yet implemented');
  });
});

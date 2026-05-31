// Phase 72 Wave 0 — Nyquist failing scaffold
// Maps to COMPL-07 PaymentRunComplianceCheck atomicity; wired in
// packages/api/src/routers/finance/payment.ts payment.lockAndExport (Plan 72-06).

import { describe, expect, it } from 'vitest';

describe('payment-run-compliance-check atomic-compliance-check', () => {
  it('writes PaymentRunComplianceCheck PASS rows in SAME tx as PaymentExport', async () => {
    throw new Error('payment.lockAndExport atomic compliance-check not yet implemented');
  });

  it('snapshotJson captures full ContractorComplianceItem rows (frozen copy)', async () => {
    throw new Error('snapshot capture not yet implemented');
  });
});

describe('payment-run-compliance-check toctou-abort', () => {
  it('aborts export when contractor newly fails between create and export', async () => {
    throw new Error('TOCTOU re-assertion not yet implemented');
  });
});

describe('payment-run-compliance-check fail-verdict-recording', () => {
  it('writes FAIL-verdict rows with paymentExportId=null in separate small tx', async () => {
    throw new Error('fail-verdict separate-tx recording not yet implemented');
  });
});

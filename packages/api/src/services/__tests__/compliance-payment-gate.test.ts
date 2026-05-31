// Phase 72 Wave 0 — Nyquist failing scaffold
// Maps to COMPL-05 payment-block enforcement; helper lives in
// packages/api/src/services/compliance-payment-gate.ts (Plan 72-04).

import { describe, expect, it } from 'vitest';

describe('compliance-payment-gate assertion', () => {
  it('throws PRECONDITION_FAILED with structured cause when contractor has BLOCKING+EXPIRED item', async () => {
    const mod = await import('../compliance-payment-gate.js');
    expect(mod.assertContractorPaymentEligibility).toBeTypeOf('function');
    throw new Error('assertContractorPaymentEligibility not yet implemented');
  });

  it('returns blocked=false when contractor has only WARNING-severity expired items', async () => {
    throw new Error('severity filter not yet implemented');
  });

  it('returns blocked=false when contractor has BLOCKING+SATISFIED items', async () => {
    throw new Error('status filter not yet implemented');
  });
});

describe('compliance-payment-gate flag-off', () => {
  it('flag OFF returns { blocked: false, wouldBlock: true } and emits WARN log + AuditLog', async () => {
    throw new Error('would-block path not yet implemented');
  });
});

describe('compliance-payment-gate tx interop', () => {
  it('accepts an active tx and reads via the transaction client', async () => {
    throw new Error('tx-overload not yet implemented');
  });
});

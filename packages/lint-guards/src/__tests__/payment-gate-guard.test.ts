// Phase 72 Wave 0 — Nyquist failing scaffold
// Maps to COMPL-05 CI lint guard ensuring helper-coverage at every payment-write
// entry point; lint rule lives in
// packages/lint-guards/src/payment-gate-guard/run-guard.ts (Plan 72-04).

import { describe, expect, it } from 'vitest';

describe('payment-gate-guard', () => {
  it('exports a runPaymentGateGuard function returning offences of payment-write procedures missing the helper', async () => {
    const mod = await import('../payment-gate-guard/run-guard.js');
    expect(mod.runPaymentGateGuard).toBeTypeOf('function');
    throw new Error('runPaymentGateGuard not yet implemented');
  });

  it('reports payment.create when the procedure body lacks assertContractorPaymentEligibility', async () => {
    throw new Error('procedure-body scan not yet implemented');
  });

  it('passes when all PAYMENT_WRITE_PROCEDURES contain the helper import', async () => {
    throw new Error('positive case not yet implemented');
  });
});

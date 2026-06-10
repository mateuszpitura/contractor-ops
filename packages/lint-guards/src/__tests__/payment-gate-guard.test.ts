// GREEN tests for payment-gate-guard.

import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatPaymentGateOffences } from '../payment-gate-guard/format-offence';
import { PAYMENT_WRITE_PROCEDURES, runPaymentGateGuard } from '../payment-gate-guard/run-guard';

const REPO_ROOT = resolve(__dirname, '../../../..');
const REAL_PAYMENT_ROUTER = resolve(REPO_ROOT, 'packages/api/src/routers/finance/payment.ts');
const FIXTURE_MISSING_GATE = resolve(__dirname, '../__fixtures__/payment-router-missing-gate.ts');

describe('payment-gate-guard', () => {
  it('exports a runPaymentGateGuard function returning offences of payment-write procedures missing the helper', () => {
    expect(runPaymentGateGuard).toBeTypeOf('function');
    expect(PAYMENT_WRITE_PROCEDURES.has('payment.create')).toBe(true);
    expect(PAYMENT_WRITE_PROCEDURES.has('payment.lockAndExport')).toBe(true);
  });

  it('reports payment.create when the procedure body lacks assertContractorPaymentEligibility', () => {
    const offences = runPaymentGateGuard({ paymentRouterPath: FIXTURE_MISSING_GATE });
    const reported = offences.map(o => o.procedure);
    expect(reported).toContain('payment.create');
    // lockAndExport DOES call the helper in the fixture → not reported.
    expect(reported).not.toContain('payment.lockAndExport');
    expect(formatPaymentGateOffences(offences)).toMatch(/payment\.create/);
  });

  it('passes (zero offences for create) once payment.create wires the helper in the real router', () => {
    const offences = runPaymentGateGuard({ paymentRouterPath: REAL_PAYMENT_ROUTER });
    expect(offences.map(o => o.procedure)).not.toContain('payment.create');
  });
});

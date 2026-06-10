// Formatter for payment-gate-guard offences.

import type { PaymentGateOffence } from './run-guard';

export function formatPaymentGateOffences(offences: readonly PaymentGateOffence[]): string {
  if (offences.length === 0) return '';
  const lines: string[] = [];
  lines.push(
    `[lint:payment-gate] FAIL: ${offences.length} payment-write procedure(s) missing assertContractorPaymentEligibility`,
  );
  lines.push('');
  for (const o of offences) {
    lines.push(`  offending:   ${o.file}:${o.line}  (procedure: ${o.procedure})`);
    lines.push(
      '  expected:    call `assertContractorPaymentEligibility(...)` in this procedure before any payment-run / export write (Phase 72 D-08)',
    );
    lines.push('');
  }
  return lines.join('\n');
}

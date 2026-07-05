// Flag-gate + strict-input contract for the payroll export procedure — RED until
// routers/workforce/payroll-export-router lands. The whole surface is dark behind
// module.workforce-employees and each target behind its per-adapter payroll.*
// flag; the .strict() input rejects mass-assignment of tenant/type fields.

import { describe, expect, it } from 'vitest';

import {
  assertPayrollTargetEnabled,
  payrollExportInput,
} from '../workforce/payroll-export-router.js';

describe('payrollExportInput (.strict())', () => {
  it('accepts a well-formed export request', () => {
    const parsed = payrollExportInput.parse({
      targetId: 'symfonia',
      employeeIds: ['wrk-pl-001', 'wrk-pl-002'],
      format: 'csv',
    });
    expect(parsed.targetId).toBe('symfonia');
    expect(parsed.employeeIds).toHaveLength(2);
  });

  it('rejects mass-assignment of organizationId / workerType', () => {
    expect(() =>
      payrollExportInput.parse({
        targetId: 'symfonia',
        employeeIds: ['wrk-pl-001'],
        organizationId: 'attacker-org',
      }),
    ).toThrow();
    expect(() =>
      payrollExportInput.parse({
        targetId: 'symfonia',
        employeeIds: ['wrk-pl-001'],
        workerType: 'CONTRACTOR',
      }),
    ).toThrow();
  });

  it('requires at least one employeeId', () => {
    expect(() => payrollExportInput.parse({ targetId: 'symfonia', employeeIds: [] })).toThrow();
  });
});

describe('assertPayrollTargetEnabled', () => {
  it('throws FORBIDDEN when the per-target flag is dark/PENDING', () => {
    expect(() => assertPayrollTargetEnabled('payroll.symfonia', { enabled: false })).toThrow(
      /FORBIDDEN|forbidden|payroll\.symfonia/i,
    );
  });

  it('passes when the per-target flag is enabled', () => {
    expect(() => assertPayrollTargetEnabled('payroll.symfonia', { enabled: true })).not.toThrow();
  });
});

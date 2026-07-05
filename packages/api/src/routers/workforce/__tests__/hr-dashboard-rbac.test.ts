// The load-bearing HR-dashboard RBAC fence.
//
// Every `hrDashboard.*` procedure gates on `requirePermission({ employee: ['read'] })`
// (the same gate the workforce routers use). This test proves that the `employee`
// base resource — and therefore the whole HR dashboard surface — resolves to the
// four HR roles and NO other role.
//
// Correction to the phase plans: `owner` does NOT pass. `allPermissions` (the
// owner grant set) deliberately OMITS `employee` and the personnel-file sections
// (the BFLA fence in roles.ts) so the org owner cannot reach the HR personnel
// surface. So the fence is exactly { hr_admin, hr_manager, payroll_officer,
// leave_approver } — identical to the existing employee/leave/time routers.

import { roles } from '@contractor-ops/auth';
import { describe, expect, it } from 'vitest';

type RoleStatements = { statements?: Record<string, readonly string[] | undefined> };

function hasEmployeeRead(roleName: keyof typeof roles): boolean {
  const role = roles[roleName] as unknown as RoleStatements;
  return role.statements?.employee?.includes('read') ?? false;
}

const HR_ROLES = ['hr_admin', 'hr_manager', 'payroll_officer', 'leave_approver'] as const;
const NON_HR_ROLES = ['owner', 'finance_admin', 'ops_manager', 'readonly'] as const;

describe('hrDashboard RBAC fence — employee:read gate', () => {
  for (const role of HR_ROLES) {
    it(`${role} holds employee:read → reaches the HR dashboard`, () => {
      expect(hasEmployeeRead(role)).toBe(true);
    });
  }

  for (const role of NON_HR_ROLES) {
    it(`${role} lacks employee:read → FORBIDDEN on every hrDashboard.* procedure`, () => {
      expect(hasEmployeeRead(role)).toBe(false);
    });
  }

  it('exactly the four HR roles hold the employee:read gate — no wider surface', () => {
    const passing = (Object.keys(roles) as (keyof typeof roles)[]).filter(hasEmployeeRead).sort();
    expect(passing).toEqual([...HR_ROLES].sort());
  });
});

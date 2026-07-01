/**
 * RED scaffold — per-section personnel-file RBAC grain (structural).
 *
 * A later wave adds four per-section resources (employeeFileA..D) to the access
 * control statement and wires them into the four HR roles. Until then these are
 * assertion-RED: the resources and grants do not exist yet, so every
 * expectation fails. The auth test directory is excluded from tsc, so the not-
 * yet-existing resources do not brick the package typecheck.
 *
 * The section→role matrix pinned here is the reviewer-verified access map:
 *   - employeeFileA..D each grant ['read', 'write'] at the statement level
 *   - owner never receives any employeeFile* grant (the BFLA fence — the same
 *     way the `employee` resource is absent from the owner's allPermissions)
 *   - hr_admin      → A/B/C/D read+write
 *   - hr_manager    → A/B/D read+write, C read-only
 *   - payroll_officer → C read-only
 *   - leave_approver  → A read-only
 */

import { describe, expect, it } from 'vitest';
import { accessControlStatement } from '../permissions.js';
import { roles } from '../roles.js';

type RoleStatements = { statements?: Record<string, readonly string[] | undefined> };

const SECTION_RESOURCES = [
  'employeeFileA',
  'employeeFileB',
  'employeeFileC',
  'employeeFileD',
] as const;

function grants(roleName: keyof typeof roles, resource: string): readonly string[] {
  const role = roles[roleName] as unknown as RoleStatements;
  return role.statements?.[resource] ?? [];
}

const statement = accessControlStatement as unknown as Record<string, readonly string[]>;

describe('access control statement — per-section personnel-file resources', () => {
  for (const resource of SECTION_RESOURCES) {
    it(`${resource} grants read + write`, () => {
      expect(statement[resource]).toContain('read');
      expect(statement[resource]).toContain('write');
    });
  }
});

describe('owner BFLA fence — no per-section grants', () => {
  for (const resource of SECTION_RESOURCES) {
    it(`owner has no ${resource} grant`, () => {
      expect(grants('owner', resource)).toEqual([]);
    });
  }
});

describe('hr_admin — read+write on every section', () => {
  for (const resource of SECTION_RESOURCES) {
    it(`hr_admin can read and write ${resource}`, () => {
      expect(grants('hr_admin', resource)).toContain('read');
      expect(grants('hr_admin', resource)).toContain('write');
    });
  }
});

describe('hr_manager — A/B/D read+write, C read-only', () => {
  for (const resource of ['employeeFileA', 'employeeFileB', 'employeeFileD'] as const) {
    it(`hr_manager can read and write ${resource}`, () => {
      expect(grants('hr_manager', resource)).toContain('read');
      expect(grants('hr_manager', resource)).toContain('write');
    });
  }

  it('hr_manager can read but not write employeeFileC', () => {
    expect(grants('hr_manager', 'employeeFileC')).toContain('read');
    expect(grants('hr_manager', 'employeeFileC')).not.toContain('write');
  });
});

describe('payroll_officer — section C read-only', () => {
  it('reads employeeFileC only, never writes it', () => {
    expect(grants('payroll_officer', 'employeeFileC')).toContain('read');
    expect(grants('payroll_officer', 'employeeFileC')).not.toContain('write');
  });

  for (const resource of ['employeeFileA', 'employeeFileB', 'employeeFileD'] as const) {
    it(`has no grant on ${resource}`, () => {
      expect(grants('payroll_officer', resource)).toEqual([]);
    });
  }
});

describe('leave_approver — section A read-only', () => {
  it('reads employeeFileA only, never writes it', () => {
    expect(grants('leave_approver', 'employeeFileA')).toContain('read');
    expect(grants('leave_approver', 'employeeFileA')).not.toContain('write');
  });

  for (const resource of ['employeeFileB', 'employeeFileC', 'employeeFileD'] as const) {
    it(`has no grant on ${resource}`, () => {
      expect(grants('leave_approver', resource)).toEqual([]);
    });
  }
});

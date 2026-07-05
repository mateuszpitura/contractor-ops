import { describe, expect, it } from 'vitest';
import { accessControlStatement } from '../permissions.js';
import { roles } from '../roles.js';

describe('roles', () => {
  /** The 10 platform roles that predate the worker-model HR roles. */
  const existingRoleNames = [
    'owner',
    'admin',
    'finance_admin',
    'ops_manager',
    'team_manager',
    'legal_compliance_viewer',
    'it_admin',
    'external_accountant',
    'readonly',
    'platform_operator',
  ] as const;

  /** HR roles introduced for the worker-model employee abstraction. */
  const hrRoleNames = ['hr_admin', 'hr_manager', 'payroll_officer', 'leave_approver'] as const;

  const roleNames = [...existingRoleNames, ...hrRoleNames] as const;

  it('defines all exported platform roles', () => {
    expect(Object.keys(roles)).toHaveLength(roleNames.length);
    for (const name of roleNames) {
      expect(roles[name].statements).toBeDefined();
    }
  });

  it('owner matches the full access control statement except platform-only admin:boe-rate and HR-only employee', () => {
    const o = roles.owner.statements;
    for (const [resource, actions] of Object.entries(accessControlStatement)) {
      if (resource === 'admin:boe-rate' || resource === 'admin:marketplace') {
        // The admin:* resources are global platform resources exclusive to
        // platform_operator. Per-org roles (owner included) must NOT have them.
        expect(o[resource as keyof typeof o]).toBeUndefined();
        continue;
      }
      if (resource === 'employee') {
        // `employee` is an HR-only resource granted exclusively to the worker-model
        // HR roles. Owner is sourced from the duplicated allPermissions const, which
        // deliberately does not carry `employee`, so owner does not hold it.
        expect(o[resource as keyof typeof o]).toBeUndefined();
        continue;
      }
      if (resource.startsWith('employeeFile')) {
        // The per-section personnel-file resources are HR-only. Like `employee`,
        // they are absent from the owner's allPermissions duplicate so the owner
        // cannot silently reach a personnel-file section it was never granted.
        expect(o[resource as keyof typeof o]).toBeUndefined();
        continue;
      }
      expect(o[resource as keyof typeof o]?.slice().sort()).toEqual([...actions].sort());
    }
  });

  it('admin does not carry the platform-only admin:boe-rate resource', () => {
    expect(
      roles.admin.statements['admin:boe-rate' as keyof typeof roles.admin.statements],
    ).toBeUndefined();
  });

  it('platform_operator is the sole holder of admin:boe-rate', () => {
    for (const [name, role] of Object.entries(roles)) {
      const statements = role.statements as Record<string, readonly string[] | undefined>;
      if (name === 'platform_operator') {
        expect(statements['admin:boe-rate']).toEqual(['read', 'write']);
      } else {
        expect(statements['admin:boe-rate']).toBeUndefined();
      }
    }
  });

  it('admin matches owner on all resources EXCEPT workflow override_blocking_task + public-API-only reads', () => {
    // workflow:override_blocking_task is OWNER-only; admin retains every other permission owner has.
    // classification/auditLog are public-REST read gates consumed by API keys + owner only —
    // deliberately NOT granted to admin (or any named role).
    const owner = roles.owner.statements;
    const admin = roles.admin.statements;
    const ownerOnlyResources = new Set(['classification', 'auditLog']);
    for (const resource of Object.keys(owner)) {
      const ownerActions = (owner[resource as keyof typeof owner] ?? []) as readonly string[];
      const adminActions = (admin[resource as keyof typeof admin] ?? []) as readonly string[];
      if (resource === 'workflow') {
        // Admin has owner's workflow set MINUS override_blocking_task.
        const expected = ownerActions.filter(a => a !== 'override_blocking_task');
        expect([...adminActions].sort()).toEqual([...expected].sort());
        expect(adminActions).not.toContain('override_blocking_task');
      } else if (ownerOnlyResources.has(resource)) {
        expect(adminActions).toEqual([]);
      } else {
        expect([...adminActions].sort()).toEqual([...ownerActions].sort());
      }
    }
  });

  it('owner and admin both hold idp:override_step_failure + idp:start_run', () => {
    // idp:start_run is granted alongside override_step_failure to owner and admin.
    // Order-tolerant compare — the role array order is not a contract.
    expect(roles.owner.statements.idp?.slice().sort()).toEqual(
      ['override_step_failure', 'start_run'].sort(),
    );
    expect(roles.admin.statements.idp?.slice().sort()).toEqual(
      ['override_step_failure', 'start_run'].sort(),
    );
  });

  it('it_admin holds EXACTLY idp:start_run and NOT idp:override_step_failure', () => {
    // it_admin is the seeded ACCESS_REVOKE assignee, so the inline task-card
    // deprovisioning trigger must be usable by it_admin. It gains ONLY start_run;
    // override_step_failure stays owner/admin-only.
    expect(roles.it_admin.statements.idp).toEqual(['start_run']);
    expect(roles.it_admin.statements.idp).not.toContain('override_step_failure');
  });

  it('no role other than owner/admin/it_admin holds any idp action; only owner/admin hold override_step_failure', () => {
    for (const [name, role] of Object.entries(roles)) {
      const statements = role.statements as Record<string, readonly string[] | undefined>;
      if (name === 'owner' || name === 'admin') {
        expect(statements.idp).toContain('override_step_failure');
        continue;
      }
      if (name === 'it_admin') {
        // it_admin holds idp (start_run) but NEVER the override action.
        expect(statements.idp).toEqual(['start_run']);
        continue;
      }
      expect(statements.idp, `${name} must not hold idp permissions`).toBeUndefined();
    }
  });

  it('finance_admin cannot create or bulk-update contractors', () => {
    expect(roles.finance_admin.statements.contractor).toEqual(['read']);
  });

  it('readonly has only read actions on every granted resource', () => {
    for (const actions of Object.values(roles.readonly.statements)) {
      for (const a of actions) {
        expect(a).toBe('read');
      }
    }
  });

  it('it_admin cannot read invoices or contractors', () => {
    expect(roles.it_admin.statements.invoice).toBeUndefined();
    expect(roles.it_admin.statements.contractor).toBeUndefined();
  });

  it('external_accountant has read-only payment access', () => {
    expect(roles.external_accountant.statements.payment).toEqual(['read']);
  });

  it('ops_manager cannot manage members, invitations, or organization', () => {
    expect(roles.ops_manager.statements.member).toBeUndefined();
    expect(roles.ops_manager.statements.invitation).toBeUndefined();
    expect(roles.ops_manager.statements.organization).toBeUndefined();
  });

  it('ops_manager cannot approve invoices', () => {
    expect(roles.ops_manager.statements.invoice).toEqual(expect.not.arrayContaining(['approve']));
  });

  it('team_manager cannot create or delete contractors', () => {
    expect(roles.team_manager.statements.contractor).toEqual(['read', 'update']);
  });

  it('team_manager cannot manage documents, settings, or integrations', () => {
    expect(roles.team_manager.statements.document).toBeUndefined();
    expect(roles.team_manager.statements.settings).toBeUndefined();
    expect(roles.team_manager.statements.integration).toBeUndefined();
  });

  it('legal_compliance_viewer has no write access on any resource', () => {
    for (const actions of Object.values(roles.legal_compliance_viewer.statements)) {
      for (const a of actions) {
        expect(a).toBe('read');
      }
    }
  });

  it('legal_compliance_viewer cannot access payment, settings, or integration', () => {
    expect(roles.legal_compliance_viewer.statements.payment).toBeUndefined();
    expect(roles.legal_compliance_viewer.statements.settings).toBeUndefined();
    expect(roles.legal_compliance_viewer.statements.integration).toBeUndefined();
  });

  it('external_accountant cannot modify anything (all permissions are read or export)', () => {
    for (const actions of Object.values(roles.external_accountant.statements)) {
      for (const a of actions) {
        expect(['read', 'export']).toContain(a);
      }
    }
  });

  // contractorPii:read is granted to owner/admin/finance_admin ONLY; external_accountant is
  // DELIBERATELY denied (external-party full-SSN access is a liability + data-minimization call),
  // as are the other 6.
  it('contractorPii:read is granted to exactly owner, admin, finance_admin', () => {
    const granted = ['owner', 'admin', 'finance_admin'] as const;
    for (const name of granted) {
      const statements = roles[name].statements as Record<string, readonly string[] | undefined>;
      expect(statements.contractorPii, `${name} must hold contractorPii:read`).toEqual(['read']);
    }
  });

  it('contractorPii:read is DENIED to the other 7 roles incl. external_accountant', () => {
    const denied = [
      'ops_manager',
      'team_manager',
      'legal_compliance_viewer',
      'it_admin',
      'external_accountant',
      'readonly',
      'platform_operator',
    ] as const;
    for (const name of denied) {
      const statements = roles[name].statements as Record<string, readonly string[] | undefined>;
      expect(statements.contractorPii, `${name} must NOT hold contractorPii`).toBeUndefined();
    }
  });

  it('owner holds contractorPii:read via the allPermissions duplicate (drift regression guard)', () => {
    // Regression guard: adding contractorPii to permissions.ts but forgetting the
    // duplicated allPermissions const in roles.ts would leave owner silently denied.
    const owner = roles.owner.statements as Record<string, readonly string[] | undefined>;
    expect(owner.contractorPii).toEqual(['read']);
  });

  // --- Worker-model HR roles + per-type RBAC -------------------------------

  it('the employee resource is present in the access control statement', () => {
    expect(accessControlStatement).toHaveProperty('employee');
    expect([...accessControlStatement.employee].sort()).toEqual(
      ['approve_leave', 'create', 'delete', 'read', 'update'].sort(),
    );
  });

  it('the four HR roles exist with the documented employee grants', () => {
    expect(roles.hr_admin.statements.employee?.slice().sort()).toEqual(
      ['approve_leave', 'create', 'delete', 'read', 'update'].sort(),
    );
    expect(roles.hr_manager.statements.employee?.slice().sort()).toEqual(['read', 'update'].sort());
    expect(roles.payroll_officer.statements.employee).toEqual(['read']);
    expect(roles.leave_approver.statements.employee?.slice().sort()).toEqual(
      ['approve_leave', 'read'].sort(),
    );
  });

  it('no HR role can create, update, delete, or bulk-mutate contractors (BFLA fence)', () => {
    const mutations = ['create', 'update', 'delete', 'bulk'];
    for (const name of hrRoleNames) {
      const contractor = (roles[name].statements.contractor ?? []) as readonly string[];
      for (const action of mutations) {
        expect(contractor, `${name} must not hold contractor:${action}`).not.toContain(action);
      }
    }
  });

  it('no HR role holds contractorPii, payment-write, idp, member, or organization access', () => {
    for (const name of hrRoleNames) {
      const s = roles[name].statements as Record<string, readonly string[] | undefined>;
      expect(s.contractorPii, `${name} must not reveal SSN PII`).toBeUndefined();
      expect(s.idp, `${name} must not hold idp actions`).toBeUndefined();
      expect(s.member, `${name} must not manage members`).toBeUndefined();
      expect(s.organization, `${name} must not manage the organization`).toBeUndefined();
      const payment = (s.payment ?? []) as readonly string[];
      for (const action of payment) {
        expect(action, `${name} payment grant must be read-only`).toBe('read');
      }
    }
  });

  // The 10 pre-existing platform roles must stay byte-identical after the HR
  // roles were added. The exact per-role grant for every role (existing + new)
  // is frozen in role-permission-matrix.test.ts. This guard freezes the SET of
  // pre-existing role names so none is removed or renamed, and re-asserts that
  // the new HR roles are strictly additive (no existing key mutated).
  it('the 10 pre-existing role names are all still present and unchanged in count', () => {
    for (const name of existingRoleNames) {
      expect(roles[name]?.statements, `${name} role must still exist`).toBeDefined();
    }
    // Existing + the 4 additive HR roles, nothing else.
    expect(Object.keys(roles).sort()).toEqual([...existingRoleNames, ...hrRoleNames].sort());
  });
});

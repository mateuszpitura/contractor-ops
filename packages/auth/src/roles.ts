import { ac } from './permissions.js';

/**
 * Predefined roles for the Contractor Ops platform: the 10 core roles plus the
 * four worker-model HR roles (hr_admin, hr_manager, payroll_officer,
 * leave_approver) that gate the employee surface.
 *
 * Each role grants a specific subset of permissions defined in permissions.ts.
 * Roles are assigned to organization members and enforced via tRPC middleware.
 */
/**
 * All permissions from the access control statement.
 * Used for the owner role which has full access.
 *
 * NOTE: `admin:boe-rate` is a global platform resource and is intentionally
 * NOT granted to any per-org role (including owner). It is exclusive to the
 * `platform_operator` role below, which is assigned to the dedicated
 * operator org that manages cross-tenant reference data.
 */
const allPermissions = {
  organization: ['update', 'delete'],
  member: ['create', 'read', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  contractor: ['create', 'read', 'update', 'delete', 'bulk'],
  contract: ['create', 'read', 'update', 'delete'],
  compliance: ['read', 'override'],
  document: ['create', 'read', 'update', 'delete'],
  invoice: ['create', 'read', 'update', 'delete', 'approve'],
  workflow: ['create', 'read', 'update', 'delete', 'execute', 'override_blocking_task'],
  idp: ['override_step_failure', 'start_run'],
  payment: ['create', 'read', 'update', 'export'],
  report: ['read', 'export'],
  settings: ['read', 'update'],
  integration: ['read', 'update'],
  time: ['read', 'approve'],
  equipment: ['read', 'create', 'update', 'delete'],
  team: ['read', 'create', 'update', 'archive'],
  project: ['read', 'create', 'update', 'archive'],
  costCenter: ['read', 'create', 'update', 'archive'],
  // This `allPermissions` const is a DUPLICATE of accessControlStatement and is
  // the sole source for the owner role. It MUST stay in sync with permissions.ts
  // or owner silently loses newly added permissions — with ONE deliberate
  // exception: the HR-only resources (`employee` and the personnel-file sections
  // employeeFileA..D) are intentionally omitted so the owner cannot reach the HR
  // personnel surface. That absence is the fence, not drift — do not "sync" it.
  contractorPii: ['read'],
  employeePii: ['read'],
  // Public REST read gates (API-key + owner only; not granted to any named role).
  // Kept in sync with accessControlStatement to preserve the owner-superset invariant.
  classification: ['read'],
  auditLog: ['read'],
} as const;

export const roles = {
  /**
   * Owner role: org creator, full access to everything.
   * Explicitly defined because Better Auth v1.5.5 has a bug where
   * allowCreatorAllPermissions doesn't propagate to hasPermissionFn.
   */
  owner: ac.newRole(allPermissions),

  admin: ac.newRole({
    organization: ['update', 'delete'],
    member: ['create', 'read', 'update', 'delete'],
    invitation: ['create', 'cancel'],
    contractor: ['create', 'read', 'update', 'delete', 'bulk'],
    contract: ['create', 'read', 'update', 'delete'],
    compliance: ['read', 'override'],
    document: ['create', 'read', 'update', 'delete'],
    invoice: ['create', 'read', 'update', 'delete', 'approve'],
    workflow: ['create', 'read', 'update', 'delete', 'execute'],
    idp: ['override_step_failure', 'start_run'],
    payment: ['create', 'read', 'update', 'export'],
    report: ['read', 'export'],
    settings: ['read', 'update'],
    integration: ['read', 'update'],
    time: ['read', 'approve'],
    equipment: ['read', 'create', 'update', 'delete'],
    team: ['read', 'create', 'update', 'archive'],
    project: ['read', 'create', 'update', 'archive'],
    costCenter: ['read', 'create', 'update', 'archive'],
    contractorPii: ['read'],
    employeePii: ['read'],
  }),

  finance_admin: ac.newRole({
    contractor: ['read'],
    contract: ['read'],
    compliance: ['read'],
    invoice: ['create', 'read', 'update', 'delete', 'approve'],
    payment: ['create', 'read', 'update', 'export'],
    report: ['read', 'export'],
    settings: ['read'],
    time: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
    contractorPii: ['read'],
  }),

  ops_manager: ac.newRole({
    contractor: ['create', 'read', 'update', 'delete', 'bulk'],
    contract: ['create', 'read', 'update', 'delete'],
    compliance: ['read'],
    invoice: ['create', 'read', 'update'],
    workflow: ['create', 'read', 'update', 'delete', 'execute'],
    report: ['read', 'export'],
    settings: ['read'],
    time: ['read', 'approve'],
    equipment: ['read', 'create', 'update', 'delete'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  }),

  team_manager: ac.newRole({
    contractor: ['read', 'update'],
    contract: ['read'],
    compliance: ['read'],
    invoice: ['read', 'approve'],
    workflow: ['read', 'execute'],
    report: ['read'],
    time: ['read', 'approve'],
    equipment: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  }),

  legal_compliance_viewer: ac.newRole({
    contractor: ['read'],
    contract: ['read'],
    compliance: ['read'],
    invoice: ['read'],
    report: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  }),

  it_admin: ac.newRole({
    member: ['create', 'read', 'update'],
    invitation: ['create', 'cancel'],
    settings: ['read', 'update'],
    integration: ['read', 'update'],
    // it_admin is the seeded ACCESS_REVOKE assignee, so the inline deprovisioning
    // trigger must be reachable by it_admin. It holds start_run ONLY — the
    // override_step_failure escalation stays owner/admin-only.
    idp: ['start_run'],
    equipment: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  }),

  external_accountant: ac.newRole({
    contractor: ['read'],
    contract: ['read'],
    compliance: ['read'],
    invoice: ['read'],
    payment: ['read'],
    report: ['read', 'export'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  }),

  readonly: ac.newRole({
    contractor: ['read'],
    contract: ['read'],
    compliance: ['read'],
    invoice: ['read'],
    workflow: ['read'],
    report: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  }),

  /**
   * Platform operator: manages cross-tenant reference data (e.g. the
   * Bank-of-England base rate that drives late-payment-interest claims
   * across every GB B2B invoice in the system). Assigned only to members
   * of the dedicated platform-operator org. Explicitly does NOT inherit
   * any tenant-facing permission (contractor, invoice, payment, …) so an
   * operator cannot read or mutate customer data.
   */
  platform_operator: ac.newRole({
    'admin:boe-rate': ['read', 'write'],
  }),

  // HR roles for the worker-model employee abstraction. Each grants ONLY the
  // `employee` resource (plus a read on `contractor` for shared worker context
  // where the role needs it) and NEVER contractor create/update/delete/bulk —
  // an HR role must not be able to mutate contractors. Names follow the existing
  // snake_case role convention (the requirement document lists them UPPER_SNAKE;
  // the codebase keys roles in snake_case, so they are reconciled here).
  hr_admin: ac.newRole({
    employee: ['create', 'read', 'update', 'delete', 'approve_leave'],
    // Full national-ID reveal is HR-admin-only among the HR roles; hr_manager,
    // payroll_officer and leave_approver get the employee surface but never PII.
    employeePii: ['read'],
    // Full personnel-file access: the HR administrator reads and writes every
    // section (A: master/leave, B: discipline, C: pay, D: other).
    employeeFileA: ['read', 'write'],
    employeeFileB: ['read', 'write'],
    employeeFileC: ['read', 'write'],
    employeeFileD: ['read', 'write'],
    contractor: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  }),

  hr_manager: ac.newRole({
    employee: ['read', 'update'],
    // Manages most of the file but the pay section (C) is read-only — payroll
    // figures are not a line manager's to edit.
    employeeFileA: ['read', 'write'],
    employeeFileB: ['read', 'write'],
    employeeFileC: ['read'],
    employeeFileD: ['read', 'write'],
    contractor: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  }),

  payroll_officer: ac.newRole({
    employee: ['read'],
    // Payroll reaches only the pay section, and only to read it — never
    // discipline (B) or the rest of the file.
    employeeFileC: ['read'],
    payment: ['read'],
    report: ['read', 'export'],
  }),

  leave_approver: ac.newRole({
    employee: ['read', 'approve_leave'],
    // Leave approval needs only the master/leave section, read-only.
    employeeFileA: ['read'],
  }),
} as const;

/** Union type of all role names */
export type RoleName = keyof typeof roles;

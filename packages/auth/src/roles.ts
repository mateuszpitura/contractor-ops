import { ac } from './permissions.js';

/**
 * 9 predefined roles for the Contractor Ops platform.
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
  document: ['create', 'read', 'update', 'delete'],
  invoice: ['create', 'read', 'update', 'delete', 'approve'],
  workflow: ['create', 'read', 'update', 'delete', 'execute', 'override_blocking_task'],
  idp: ['override_step_failure'],
  payment: ['create', 'read', 'update', 'export'],
  report: ['read', 'export'],
  settings: ['read', 'update'],
  integration: ['read', 'update'],
  time: ['read', 'approve'],
  equipment: ['read', 'create', 'update', 'delete'],
  team: ['read', 'create', 'update', 'archive'],
  project: ['read', 'create', 'update', 'archive'],
  costCenter: ['read', 'create', 'update', 'archive'],
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
    document: ['create', 'read', 'update', 'delete'],
    invoice: ['create', 'read', 'update', 'delete', 'approve'],
    workflow: ['create', 'read', 'update', 'delete', 'execute'],
    idp: ['override_step_failure'],
    payment: ['create', 'read', 'update', 'export'],
    report: ['read', 'export'],
    settings: ['read', 'update'],
    integration: ['read', 'update'],
    time: ['read', 'approve'],
    equipment: ['read', 'create', 'update', 'delete'],
    team: ['read', 'create', 'update', 'archive'],
    project: ['read', 'create', 'update', 'archive'],
    costCenter: ['read', 'create', 'update', 'archive'],
  }),

  finance_admin: ac.newRole({
    contractor: ['read'],
    contract: ['read'],
    invoice: ['create', 'read', 'update', 'delete', 'approve'],
    payment: ['create', 'read', 'update', 'export'],
    report: ['read', 'export'],
    settings: ['read'],
    time: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  }),

  ops_manager: ac.newRole({
    contractor: ['create', 'read', 'update', 'delete', 'bulk'],
    contract: ['create', 'read', 'update', 'delete'],
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
    equipment: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  }),

  external_accountant: ac.newRole({
    contractor: ['read'],
    contract: ['read'],
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
} as const;

/** Union type of all role names */
export type RoleName = keyof typeof roles;

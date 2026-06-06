import { createAccessControl } from 'better-auth/plugins/access';

/**
 * Access control statement defining all resource-action pairs
 * for the Contractor Ops platform.
 *
 * Each resource maps to the set of actions that can be performed on it.
 * Roles are defined in roles.ts by selecting subsets of these permissions.
 *
 * Exported as `accessControlStatement` for tests — must stay in sync with roles.
 */
export const accessControlStatement = {
  organization: ['update', 'delete'],
  member: ['create', 'read', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  contractor: ['create', 'read', 'update', 'delete', 'bulk'],
  contract: ['create', 'read', 'update', 'delete'],
  compliance: ['read', 'override'], // Phase 73 D-10 — admin override + per-role read
  document: ['create', 'read', 'update', 'delete'],
  invoice: ['create', 'read', 'update', 'delete', 'approve'],
  workflow: ['create', 'read', 'update', 'delete', 'execute', 'override_blocking_task'],
  // IdP deprovisioning actions:
  //   override_step_failure — mark a terminally-failed step MANUAL_COMPLETED
  //     (owner + admin only, mirrors workflow override_blocking_task).
  //   start_run — start a deprovisioning run / read eligibility
  //     (owner + admin + it_admin; it_admin is the seeded ACCESS_REVOKE assignee).
  // See roles.ts for the per-role grants.
  idp: ['override_step_failure', 'start_run'],
  payment: ['create', 'read', 'update', 'export'],
  report: ['read', 'export'],
  settings: ['read', 'update'],
  integration: ['read', 'update'],
  time: ['read', 'approve'],
  equipment: ['read', 'create', 'update', 'delete'],
  // Organization Definitions (Teams / Projects / Cost Centers)
  // Read is granted to every role so the contractor wizard dropdowns keep working;
  // mutating actions (create / update / archive) require owner or admin.
  team: ['read', 'create', 'update', 'archive'],
  project: ['read', 'create', 'update', 'archive'],
  costCenter: ['read', 'create', 'update', 'archive'],
  'admin:boe-rate': ['read', 'write'],
} as const;

export const ac = createAccessControl(accessControlStatement);

/** Resource names from the access control statement */
type Resource = keyof typeof accessControlStatement;

/** Action names for a given resource */
type ActionsFor<R extends Resource> = (typeof accessControlStatement)[R][number];

/**
 * Permission type: a partial record mapping resources to arrays of their actions.
 * Used in tRPC middleware to declare required permissions for a procedure.
 *
 * Example: { contractor: ["read", "update"] }
 */
export type Permission = {
  [R in Resource]?: ActionsFor<R>[];
};

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
  // Phase 77 D-12 — IdP deprovisioning: marking a terminally-failed step
  // MANUAL_COMPLETED. Granted to owner + admin only (mirrors the workflow
  // override_blocking_task pattern). See roles.ts.
  idp: ['override_step_failure'],
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

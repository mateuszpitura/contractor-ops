import { ac } from "./permissions.js";

/**
 * 9 predefined roles for the Contractor Ops platform.
 *
 * Each role grants a specific subset of permissions defined in permissions.ts.
 * Roles are assigned to organization members and enforced via tRPC middleware.
 */
/**
 * All permissions from the access control statement.
 * Used for the owner role which has full access.
 */
const allPermissions = {
  organization: ["update", "delete"],
  member: ["create", "read", "update", "delete"],
  invitation: ["create", "cancel"],
  contractor: ["create", "read", "update", "delete", "bulk"],
  contract: ["create", "read", "update", "delete"],
  document: ["create", "read", "update", "delete"],
  invoice: ["create", "read", "update", "delete", "approve"],
  workflow: ["create", "read", "update", "delete", "execute"],
  payment: ["create", "read", "export"],
  report: ["read", "export"],
  settings: ["read", "update"],
  integration: ["read", "update"],
  time: ["read", "approve"],
  equipment: ["read", "create", "update", "delete"],
} as const;

export const roles = {
  /**
   * Owner role: org creator, full access to everything.
   * Explicitly defined because Better Auth v1.5.5 has a bug where
   * allowCreatorAllPermissions doesn't propagate to hasPermissionFn.
   */
  owner: ac.newRole(allPermissions),

  admin: ac.newRole({
    organization: ["update", "delete"],
    member: ["create", "read", "update", "delete"],
    invitation: ["create", "cancel"],
    contractor: ["create", "read", "update", "delete", "bulk"],
    contract: ["create", "read", "update", "delete"],
    document: ["create", "read", "update", "delete"],
    invoice: ["create", "read", "update", "delete", "approve"],
    workflow: ["create", "read", "update", "delete", "execute"],
    payment: ["create", "read", "export"],
    report: ["read", "export"],
    settings: ["read", "update"],
    integration: ["read", "update"],
    time: ["read", "approve"],
    equipment: ["read", "create", "update", "delete"],
  }),

  finance_admin: ac.newRole({
    contractor: ["read"],
    contract: ["read"],
    invoice: ["create", "read", "update", "delete", "approve"],
    payment: ["create", "read", "export"],
    report: ["read", "export"],
    settings: ["read"],
    time: ["read"],
  }),

  ops_manager: ac.newRole({
    contractor: ["create", "read", "update", "delete", "bulk"],
    contract: ["create", "read", "update", "delete"],
    invoice: ["create", "read", "update"],
    workflow: ["create", "read", "update", "delete", "execute"],
    report: ["read", "export"],
    settings: ["read"],
    time: ["read", "approve"],
    equipment: ["read", "create", "update", "delete"],
  }),

  team_manager: ac.newRole({
    contractor: ["read", "update"],
    contract: ["read"],
    invoice: ["read", "approve"],
    workflow: ["read", "execute"],
    report: ["read"],
    time: ["read", "approve"],
    equipment: ["read"],
  }),

  legal_compliance_viewer: ac.newRole({
    contractor: ["read"],
    contract: ["read"],
    invoice: ["read"],
    report: ["read"],
  }),

  it_admin: ac.newRole({
    member: ["create", "read", "update"],
    invitation: ["create", "cancel"],
    settings: ["read", "update"],
    integration: ["read", "update"],
    equipment: ["read"],
  }),

  external_accountant: ac.newRole({
    contractor: ["read"],
    contract: ["read"],
    invoice: ["read"],
    payment: ["read"],
    report: ["read", "export"],
  }),

  readonly: ac.newRole({
    contractor: ["read"],
    contract: ["read"],
    invoice: ["read"],
    workflow: ["read"],
    report: ["read"],
  }),
} as const;

/** Union type of all role names */
export type RoleName = keyof typeof roles;

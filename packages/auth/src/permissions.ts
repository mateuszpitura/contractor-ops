import { createAccessControl } from "better-auth/plugins/access";

/**
 * Access control statement defining all resource-action pairs
 * for the Contractor Ops platform.
 *
 * Each resource maps to the set of actions that can be performed on it.
 * Roles are defined in roles.ts by selecting subsets of these permissions.
 */
const statement = {
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

export const ac = createAccessControl(statement);

/** Resource names from the access control statement */
type Resource = keyof typeof statement;

/** Action names for a given resource */
type ActionsFor<R extends Resource> = (typeof statement)[R][number];

/**
 * Permission type: a partial record mapping resources to arrays of their actions.
 * Used in tRPC middleware to declare required permissions for a procedure.
 *
 * Example: { contractor: ["read", "update"] }
 */
export type Permission = {
  [R in Resource]?: ActionsFor<R>[];
};

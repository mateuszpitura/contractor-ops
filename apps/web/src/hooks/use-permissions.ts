"use client";

import { authClient } from "@/lib/auth-client";

/**
 * Custom hook that reads the current user's role from the Better Auth session
 * and provides a permission checker function.
 *
 * Permission checks are based on the role definitions in packages/auth/src/roles.ts.
 * The `can` function checks resource + action pairs against the role's permissions.
 */
export function usePermissions() {
  const session = authClient.useSession();
  const role = (session?.data?.session as Record<string, unknown> | undefined)
    ?.activeOrganizationRole as string | undefined;

  return {
    /**
     * Check if the current user's role has permission for a resource + action.
     * Returns false if no session or role is available.
     */
    can: (resource: string, actions: string[]): boolean => {
      if (!role) return false;

      // Permission matrix matching packages/auth/src/roles.ts
      const permissions: Record<string, Record<string, string[]>> = {
        admin: {
          organization: ["update", "delete"],
          member: ["create", "read", "update", "delete"],
          invitation: ["create", "cancel"],
          contractor: ["create", "read", "update", "delete", "bulk"],
          contract: ["create", "read", "update", "delete"],
          invoice: ["create", "read", "update", "delete", "approve"],
          workflow: ["create", "read", "update", "delete", "execute"],
          payment: ["create", "read", "export"],
          report: ["read", "export"],
          settings: ["read", "update"],
          integration: ["read", "update"],
        },
        finance_admin: {
          contractor: ["read"],
          contract: ["read"],
          invoice: ["create", "read", "update", "delete", "approve"],
          payment: ["create", "read", "export"],
          report: ["read", "export"],
          settings: ["read"],
        },
        ops_manager: {
          contractor: ["create", "read", "update", "delete", "bulk"],
          contract: ["create", "read", "update", "delete"],
          invoice: ["create", "read", "update"],
          workflow: ["create", "read", "update", "delete", "execute"],
          report: ["read", "export"],
          settings: ["read"],
        },
        team_manager: {
          contractor: ["read", "update"],
          contract: ["read"],
          invoice: ["read", "approve"],
          workflow: ["read", "execute"],
          report: ["read"],
        },
        legal_compliance_viewer: {
          contractor: ["read"],
          contract: ["read"],
          invoice: ["read"],
          report: ["read"],
        },
        it_admin: {
          member: ["create", "read", "update"],
          invitation: ["create", "cancel"],
          settings: ["read", "update"],
          integration: ["read", "update"],
        },
        external_accountant: {
          contractor: ["read"],
          contract: ["read"],
          invoice: ["read"],
          payment: ["read"],
          report: ["read", "export"],
        },
        readonly: {
          contractor: ["read"],
          contract: ["read"],
          invoice: ["read"],
          workflow: ["read"],
          report: ["read"],
        },
      };

      const rolePerms = permissions[role];
      if (!rolePerms) return false;

      const resourcePerms = rolePerms[resource];
      if (!resourcePerms) return false;

      return actions.every((action) => resourcePerms.includes(action));
    },
    role,
    isLoading: session.isPending,
    session: session.data,
  };
}

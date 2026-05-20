'use client';

import { useDashboardContext } from '@/components/layout/dashboard-context';
import { authClient } from '@/lib/auth-client';

/**
 * Permission matrix matching packages/auth/src/roles.ts.
 * "owner" is the default role Better Auth assigns to org creators — full access.
 */
/** Mirrors `packages/auth/src/roles.ts` — kept in sync via use-permissions-parity.test.ts */
const permissions: Record<string, Record<string, string[]>> = {
  owner: {
    organization: ['update', 'delete'],
    member: ['create', 'read', 'update', 'delete'],
    invitation: ['create', 'cancel'],
    contractor: ['create', 'read', 'update', 'delete', 'bulk'],
    contract: ['create', 'read', 'update', 'delete'],
    document: ['create', 'read', 'update', 'delete'],
    invoice: ['create', 'read', 'update', 'delete', 'approve'],
    workflow: ['create', 'read', 'update', 'delete', 'execute', 'override_blocking_task'],
    payment: ['create', 'read', 'update', 'export'],
    report: ['read', 'export'],
    settings: ['read', 'update'],
    integration: ['read', 'update'],
    time: ['read', 'approve'],
    equipment: ['read', 'create', 'update', 'delete'],
    team: ['read', 'create', 'update', 'archive'],
    project: ['read', 'create', 'update', 'archive'],
    costCenter: ['read', 'create', 'update', 'archive'],
  },
  admin: {
    organization: ['update', 'delete'],
    member: ['create', 'read', 'update', 'delete'],
    invitation: ['create', 'cancel'],
    contractor: ['create', 'read', 'update', 'delete', 'bulk'],
    contract: ['create', 'read', 'update', 'delete'],
    document: ['create', 'read', 'update', 'delete'],
    invoice: ['create', 'read', 'update', 'delete', 'approve'],
    workflow: ['create', 'read', 'update', 'delete', 'execute'],
    payment: ['create', 'read', 'update', 'export'],
    report: ['read', 'export'],
    settings: ['read', 'update'],
    integration: ['read', 'update'],
    time: ['read', 'approve'],
    equipment: ['read', 'create', 'update', 'delete'],
    team: ['read', 'create', 'update', 'archive'],
    project: ['read', 'create', 'update', 'archive'],
    costCenter: ['read', 'create', 'update', 'archive'],
  },
  finance_admin: {
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
  },
  ops_manager: {
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
  },
  team_manager: {
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
  },
  legal_compliance_viewer: {
    contractor: ['read'],
    contract: ['read'],
    invoice: ['read'],
    report: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  },
  it_admin: {
    member: ['create', 'read', 'update'],
    invitation: ['create', 'cancel'],
    settings: ['read', 'update'],
    integration: ['read', 'update'],
    equipment: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  },
  external_accountant: {
    contractor: ['read'],
    contract: ['read'],
    invoice: ['read'],
    payment: ['read'],
    report: ['read', 'export'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  },
  readonly: {
    contractor: ['read'],
    contract: ['read'],
    invoice: ['read'],
    workflow: ['read'],
    report: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  },
  platform_operator: {
    'admin:boe-rate': ['read', 'write'],
  },
};

/** For parity tests against `packages/auth` roles. */
export const frontendRolePermissionMatrix = permissions;

/**
 * Custom hook that provides RBAC permission checks.
 *
 * Uses the server-provided role from DashboardContext for instant access
 * (no loading flash). The role is resolved in the dashboard layout server
 * component before any client code runs.
 */
export function usePermissions() {
  const session = authClient.useSession();
  const { userRole } = useDashboardContext();

  const role = userRole ?? undefined;
  // Better Auth `User.role` (admin plugin field) — distinct from the per-org
  // role surfaced via `userRole`. Cross-tenant admin features gate on this.
  const platformRole = (session.data?.user as { role?: string | null } | undefined)?.role ?? null;
  const isPlatformAdmin = platformRole === 'admin';

  return {
    /**
     * Check if the current user's role has permission for a resource + action.
     * Returns false if no role is available.
     */
    can: (resource: string, actions: string[]): boolean => {
      if (!role) return false;

      const rolePerms = permissions[role];
      if (!rolePerms) return false;

      const resourcePerms = rolePerms[resource];
      if (!resourcePerms) return false;

      return actions.every(action => resourcePerms.includes(action));
    },
    role,
    isPlatformAdmin,
    isLoading: session.isPending,
    session: session.data,
  };
}

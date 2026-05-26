/**
 * RBAC permission checks. Step 11 codemod port from
 * apps/web/src/hooks/use-permissions.ts:
 *
 *   - `@/components/layout/dashboard-context#useDashboardContext`
 *       → consume the Better Auth session directly, reading
 *         `session.data.member.role` instead of a server-injected layout
 *         context. The legacy DashboardContext existed solely to ferry
 *         the server-resolved role to client components — in CSR the
 *         session response already carries it.
 *   - `@/lib/auth-client#authClient`
 *       → `../providers/auth-provider.js#useAuth`.
 *
 * Permission matrix copied verbatim — parity test in
 * apps/web/src/hooks/__tests__/use-permissions-parity.test.ts will lift
 * alongside it.
 */

import { useAuth } from '../providers/auth-provider.js';

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
    settings: ['read'],
    time: ['read'],
  },
  observer: {
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

export const frontendRolePermissionMatrix = permissions;

export function usePermissions() {
  const auth = useAuth();
  const session = auth.useSession();

  // Better Auth's active-member role lives on the session payload's
  // `member.role` field once the organization plugin is wired (Step 9).
  // Fall back to undefined if absent so guards default-deny.
  const member = (session.data as { member?: { role?: string | null } } | null | undefined)?.member;
  const role = member?.role ?? undefined;

  const platformRole = (session.data?.user as { role?: string | null } | undefined)?.role ?? null;
  const isPlatformAdmin = platformRole === 'admin';

  return {
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

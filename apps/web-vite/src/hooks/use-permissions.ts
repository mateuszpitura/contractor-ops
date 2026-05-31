/**
 * RBAC permission checks. Step 11 codemod port from
 * apps/web/src/hooks/use-permissions.ts:
 *
 *   - `@/components/layout/dashboard-context#useDashboardContext`
 *       → consume the Better Auth org client directly. The legacy
 *         DashboardContext ferried a server-resolved member role to
 *         client components; in CSR we resolve it via the Better Auth
 *         organization plugin's `getActiveMember` endpoint, fetched
 *         once per active session+org and cached by React Query.
 *         The original CSR port assumed `session.data.member.role`
 *         was populated automatically — it is not. Better Auth's
 *         `/get-session` intentionally omits per-org membership; the
 *         active member lives behind `/organization/get-active-member`.
 *   - `@/lib/auth-client#authClient`
 *       → `../providers/auth-provider.js#useAuth`.
 *
 * Permission matrix copied verbatim — parity test in
 * apps/web/src/hooks/__tests__/use-permissions-parity.test.ts will lift
 * alongside it.
 */

import { useQuery } from '@tanstack/react-query';
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

  // Better Auth's session payload carries the active organization id but
  // not the membership row. We fetch the active member separately and
  // cache by session token + active org so the lookup happens once per
  // session/org pair and resolves alongside the rest of the dashboard
  // bootstrap rather than on every protected interaction.
  const sessionData = session.data as
    | {
        session?: { token?: string | null; activeOrganizationId?: string | null } | null;
      }
    | null
    | undefined;
  const sessionToken = sessionData?.session?.token ?? null;
  const activeOrgId = sessionData?.session?.activeOrganizationId ?? null;

  const memberQuery = useQuery({
    queryKey: ['better-auth', 'active-member', sessionToken, activeOrgId],
    enabled: Boolean(sessionToken && activeOrgId),
    // Membership role rarely changes mid-session; a long staleTime avoids
    // redundant network chatter while still letting role updates land on
    // the next session refresh.
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const result = await auth.organization.getActiveMember();
      if (result.error) throw new Error(result.error.message ?? 'getActiveMember failed');
      return (result.data ?? null) as { id: string; role: string } | null;
    },
  });

  const role = memberQuery.data?.role ?? undefined;

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
    isLoading: session.isPending || (Boolean(sessionToken && activeOrgId) && memberQuery.isLoading),
    session: session.data,
  };
}

/**
 * RBAC permission checks.
 *
 * We resolve the active member role via the Better Auth organization
 * plugin's `getActiveMember` endpoint, fetched once per active session+org
 * and cached by React Query. `session.data.member.role` is NOT populated
 * automatically: Better Auth's `/get-session` intentionally omits per-org
 * membership; the active member lives behind `/organization/get-active-member`.
 */

import type { MemberRole } from '@contractor-ops/auth';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/auth-provider.js';

// Keyed by `MemberRole` (the canonical role union from @contractor-ops/auth) so
// a missing or stale role here is a typecheck error — this matrix MUST stay in
// sync with the server grant map (packages/auth/src/roles.ts). The drift that
// hid the sidebar for `readonly`/`legal_compliance_viewer` members is now
// caught at compile time. Type-only import — erased at runtime, no server code.
const permissions: Record<MemberRole, Record<string, string[]>> = {
  owner: {
    organization: ['update', 'delete'],
    member: ['create', 'read', 'update', 'delete'],
    invitation: ['create', 'cancel'],
    contractor: ['create', 'read', 'update', 'delete', 'bulk'],
    // SSN reveal gate. Mirrors the server roles.ts grant
    // (owner/admin/finance_admin only); the server stays the authoritative
    // boundary — this only governs reveal-control visibility.
    contractorPii: ['read'],
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
  },
  admin: {
    organization: ['update', 'delete'],
    member: ['create', 'read', 'update', 'delete'],
    invitation: ['create', 'cancel'],
    contractor: ['create', 'read', 'update', 'delete', 'bulk'],
    contractorPii: ['read'], // SSN reveal gate
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
  },
  it_admin: {
    // Mirrors the full server it_admin grant (packages/auth roles.ts; the
    // server stays authoritative). it_admin is the seeded ACCESS_REVOKE
    // assignee, so it holds idp:start_run ONLY — never idp:override_step_failure.
    member: ['create', 'read', 'update'],
    invitation: ['create', 'cancel'],
    settings: ['read', 'update'],
    integration: ['read', 'update'],
    idp: ['start_run'],
    equipment: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  },
  finance_admin: {
    contractor: ['read'],
    contractorPii: ['read'], // SSN reveal gate
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
  },
  ops_manager: {
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
  },
  team_manager: {
    contractor: ['read', 'update'],
    contract: ['read'],
    compliance: ['read'],
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
    compliance: ['read'],
    invoice: ['read'],
    payment: ['read'],
    report: ['read', 'export'],
    settings: ['read'],
    time: ['read'],
  },
  legal_compliance_viewer: {
    contractor: ['read'],
    contract: ['read'],
    compliance: ['read'],
    invoice: ['read'],
    report: ['read'],
    team: ['read'],
    project: ['read'],
    costCenter: ['read'],
  },
  readonly: {
    contractor: ['read'],
    contract: ['read'],
    compliance: ['read'],
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
      // `role` is the raw server string; an unknown/legacy value yields no
      // grants (the `!rolePerms` guard below). The matrix type stays keyed by
      // MemberRole so missing/stale canonical roles fail typecheck.
      const rolePerms = permissions[role as MemberRole] as Record<string, string[]> | undefined;
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

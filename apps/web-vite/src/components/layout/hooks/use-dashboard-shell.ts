import { useQuery } from '@tanstack/react-query';

import { TOS_CURRENT_VERSION } from '../../../lib/tos.js';
import { useAuth } from '../../../providers/auth-provider.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useDashboardShell() {
  const auth = useAuth();
  const session = auth.useSession();
  const trpc = useTRPC();
  const activeOrgId = session.data?.session?.activeOrganizationId;
  const sessionToken = session.data?.session?.token ?? null;

  const orgQuery = useQuery({
    ...trpc.organization.getCurrent.queryOptions(),
    enabled: Boolean(activeOrgId) && !session.isPending,
  });

  const tosQuery = useQuery({
    ...trpc.consent.hasAcceptedToS.queryOptions({ version: TOS_CURRENT_VERSION }),
    enabled: Boolean(activeOrgId) && !session.isPending,
  });

  // Better Auth's `/get-session` does not carry the active membership; the
  // organization plugin exposes `/organization/get-active-member` for it.
  // We mirror the query key shape used by `usePermissions` so both call
  // sites share the same cache entry — one network round-trip resolves
  // role for both header/avatar UI and RBAC gating.
  const memberQuery = useQuery({
    queryKey: ['better-auth', 'active-member', sessionToken, activeOrgId ?? null],
    enabled: Boolean(sessionToken && activeOrgId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const result = await auth.organization.getActiveMember();
      if (result.error) throw new Error(result.error.message ?? 'getActiveMember failed');
      return (result.data ?? null) as { id: string; role: string } | null;
    },
  });

  const org = orgQuery.data;
  const activeOrg = org
    ? { id: org.id, name: org.name, slug: org.slug, logo: org.logo ?? null }
    : null;
  const memberRole = memberQuery.data?.role ?? null;

  const needsTosAcceptance =
    Boolean(activeOrgId) && tosQuery.isSuccess && tosQuery.data.accepted === false;

  const isLoading =
    session.isPending || (Boolean(activeOrgId) && (orgQuery.isPending || tosQuery.isPending));

  return {
    session,
    activeOrgId,
    isLoading,
    activeOrg,
    memberRole,
    needsTosAcceptance,
  } as const;
}

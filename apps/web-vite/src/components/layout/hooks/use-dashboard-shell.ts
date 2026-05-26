import { useQuery } from '@tanstack/react-query';

import { TOS_CURRENT_VERSION } from '../../../lib/tos.js';
import { useAuth } from '../../../providers/auth-provider.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useDashboardShell() {
  const auth = useAuth();
  const session = auth.useSession();
  const trpc = useTRPC();
  const activeOrgId = session.data?.session?.activeOrganizationId;

  const orgQuery = useQuery({
    ...trpc.organization.getCurrent.queryOptions(),
    enabled: Boolean(activeOrgId) && !session.isPending,
  });

  const tosQuery = useQuery({
    ...trpc.consent.hasAcceptedToS.queryOptions({ version: TOS_CURRENT_VERSION }),
    enabled: Boolean(activeOrgId) && !session.isPending,
  });

  const org = orgQuery.data;
  const activeOrg = org
    ? { id: org.id, name: org.name, slug: org.slug, logo: org.logo ?? null }
    : null;
  const memberRole =
    (session.data as { member?: { role?: string | null } } | null | undefined)?.member?.role ??
    null;

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

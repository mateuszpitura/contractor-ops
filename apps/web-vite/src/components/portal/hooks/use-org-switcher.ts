import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { getClientEnv } from '../../../env.js';
import { localePath, useLocale, useRouter } from '../../../i18n/navigation.js';
import { usePortalTRPC } from '../../../providers/trpc-provider.js';

export interface OrgSwitcherOption {
  contractorId: string;
  organizationId: string;
  orgName: string;
  orgLogo: string | null;
  isCurrent: boolean;
}

export interface UseOrgSwitcherResult {
  orgs: OrgSwitcherOption[];
  isLoading: boolean;
  isAvailable: boolean;
  switchingContractorId: string | null;
  switchTo: (target: { contractorId: string; organizationId: string }) => Promise<void>;
}

export function useOrgSwitcher(): UseOrgSwitcherResult {
  const trpc = usePortalTRPC();
  const router = useRouter();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [switchingContractorId, setSwitchingContractorId] = useState<string | null>(null);

  const orgsQuery = useQuery(trpc.portal.listMyOrgs.queryOptions());

  const switchOrgMutation = useMutation(trpc.portal.switchOrg.mutationOptions());

  const orgs = (orgsQuery.data ?? []) as OrgSwitcherOption[];

  async function switchTo(target: { contractorId: string; organizationId: string }) {
    if (switchingContractorId) return;
    setSwitchingContractorId(target.contractorId);
    try {
      const session = await switchOrgMutation.mutateAsync(target);

      const response = await fetch(`${getClientEnv().VITE_API_URL}/portal/set-session`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: session.rawToken,
          expiresAt:
            session.expiresAt instanceof Date
              ? session.expiresAt.toISOString()
              : new Date(session.expiresAt).toISOString(),
          signature: session.signature,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to set portal session');
      }

      await queryClient.invalidateQueries(trpc.portal.pathFilter());
      const refetched = await queryClient.fetchQuery(trpc.portal.getSession.queryOptions());

      const sessionMatchesTarget =
        refetched.organization.id === target.organizationId &&
        refetched.subjectType === 'CONTRACTOR' &&
        refetched.contractor.id === target.contractorId;

      if (sessionMatchesTarget) {
        void router.push('/portal');
      } else {
        window.location.assign(localePath('/portal', locale));
      }
    } finally {
      setSwitchingContractorId(null);
    }
  }

  return {
    orgs,
    isLoading: orgsQuery.isLoading,
    isAvailable: orgs.length > 1,
    switchingContractorId,
    switchTo,
  };
}

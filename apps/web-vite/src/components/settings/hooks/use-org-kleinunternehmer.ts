import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

type OrgCurrent = {
  countryCode?: string | null;
  isKleinunternehmer?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

function resolveOrgCountryCode(org: OrgCurrent | undefined): string | null | undefined {
  if (!org) return;
  if (org.countryCode) return org.countryCode;
  const metadataCountry = org.metadata?.countryCode;
  return typeof metadataCountry === 'string' ? metadataCountry : null;
}

export function useOrgKleinunternehmer() {
  const trpc = useTRPC();
  const orgQuery = useQuery(trpc.organization.getCurrent.queryOptions());
  const org = orgQuery.data as OrgCurrent | undefined;

  return {
    isLoading: orgQuery.isLoading,
    orgCountryCode: resolveOrgCountryCode(org),
    isKleinunternehmer: org?.isKleinunternehmer ?? false,
  } as const;
}

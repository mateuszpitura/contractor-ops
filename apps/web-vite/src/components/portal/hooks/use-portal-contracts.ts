import { useQuery } from '@tanstack/react-query';

import { usePortalTRPC } from '../../../providers/trpc-provider.js';

export function usePortalContracts() {
  const trpc = usePortalTRPC();
  const contractsQuery = useQuery(trpc.portal.listContracts.queryOptions());

  return {
    contracts: contractsQuery.data,
    isLoading: contractsQuery.isPending,
  } as const;
}

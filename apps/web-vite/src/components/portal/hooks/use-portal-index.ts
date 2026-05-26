import { useQuery } from '@tanstack/react-query';

import { usePortalTRPC } from '../../../providers/trpc-provider.js';

export function usePortalIndex() {
  const trpc = usePortalTRPC();
  const overviewQuery = useQuery(trpc.portal.overview.queryOptions());
  const sessionQuery = useQuery(trpc.portal.getSession.queryOptions());

  return {
    overview: overviewQuery.data,
    session: sessionQuery.data,
    isLoading: overviewQuery.isPending || sessionQuery.isPending,
  } as const;
}

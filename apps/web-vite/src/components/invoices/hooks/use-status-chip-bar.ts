import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useStatusChipBar() {
  const trpc = useTRPC();
  const countsQuery = useQuery(trpc.invoice.statusCounts.queryOptions());

  return {
    isLoading: countsQuery.isLoading,
    counts: (countsQuery.data ?? {}) as Record<string, number>,
  } as const;
}

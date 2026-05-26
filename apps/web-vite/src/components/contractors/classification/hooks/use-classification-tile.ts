import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../../providers/trpc-provider.js';

export function useClassificationTile(contractorAssignmentId: string) {
  const trpc = useTRPC();

  const latestQuery = useQuery({
    ...trpc.classification.getLatest.queryOptions({
      contractorAssignmentId,
    }),
    retry: false,
  });

  return {
    latestQuery,
    latest: latestQuery.data,
    isPending: latestQuery.isPending,
  } as const;
}

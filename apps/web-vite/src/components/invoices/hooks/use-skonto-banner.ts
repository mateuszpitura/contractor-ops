import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useSkontoBanner(invoiceId: string, featureEnabled: boolean) {
  const trpc = useTRPC();

  const query = useQuery(
    trpc.skonto.evaluateForInvoice.queryOptions({ invoiceId }, { enabled: featureEnabled }),
  );

  return {
    isLoading: query.isLoading,
    data: query.data ?? null,
  } as const;
}

import { useQuery } from '@tanstack/react-query';

import { usePortalTRPC } from '../../../providers/trpc-provider.js';

export function usePortalPayments() {
  const trpc = usePortalTRPC();
  const paymentsQuery = useQuery(trpc.portal.listPayments.queryOptions());

  return {
    payments: paymentsQuery.data,
    isLoading: paymentsQuery.isPending,
  } as const;
}

import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useReconciliationList(options: { cursor?: string; limit: number }) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.time.listReconciliations.queryOptions({
      limit: options.limit,
      cursor: options.cursor,
    }),
    refetchInterval: 30000,
  });
}

export function useReconciliationSpotCheckContractors() {
  const trpc = useTRPC();
  return useQuery(trpc.time.listContractors.queryOptions());
}

export function useReconciliationSpotCheckContracts(contractorId: string) {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.contract.list.queryOptions({
      page: 1,
      pageSize: 50,
      contractorId: contractorId || undefined,
      sortBy: 'startDate',
      sortOrder: 'desc',
    }),
    enabled: Boolean(contractorId),
  });
}

export function useReconciliationSpotCheckQuery(input: {
  contractId: string;
  periodStart: string;
  periodEnd: string;
  invoicedAmountMinor: number;
  enabled: boolean;
}) {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.time.getReconciliation.queryOptions({
      contractId: input.contractId || 'placeholder',
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      invoicedAmountMinor: input.invoicedAmountMinor,
    }),
    enabled: input.enabled,
    retry: false,
  });
}

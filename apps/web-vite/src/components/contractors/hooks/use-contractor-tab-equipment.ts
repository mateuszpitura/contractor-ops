import type { AppRouter } from '@contractor-ops/api';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';

import { useTRPC } from '../../../providers/trpc-provider.js';

export type ContractorTabEquipmentItem =
  inferRouterOutputs<AppRouter>['equipment']['listByContractor'][number];

export function useContractorTabEquipment(contractorId: string) {
  const trpc = useTRPC();
  const query = useQuery(trpc.equipment.listByContractor.queryOptions({ contractorId }));
  const items = query.data ?? [];

  return {
    items,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  } as const;
}

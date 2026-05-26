import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useContractorEInvoicing(contractorId: string) {
  const trpc = useTRPC();

  const contractorQuery = useQuery(
    trpc.contractor.getById.queryOptions({ id: contractorId } as never),
  );

  const contractor = contractorQuery.data as { isPublicSectorBuyer?: boolean } | undefined;

  return {
    contractorQuery,
    contractor,
    isPublicSectorBuyer: contractor?.isPublicSectorBuyer ?? false,
  } as const;
}

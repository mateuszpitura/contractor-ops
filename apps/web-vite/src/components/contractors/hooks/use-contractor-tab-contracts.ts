import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';

export type ContractorTabContractRow = {
  id: string;
  title: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  rateValueMinor: number | null;
  currency: string;
};

export function useContractorTabContracts(contractorId: string) {
  const trpc = useTRPC();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const contractsQuery = useQuery(
    trpc.contract.list.queryOptions({
      contractorId,
      page,
      pageSize,
      sortBy: 'startDate',
      sortOrder: 'desc',
    }),
  );

  const queryData = contractsQuery.data;
  const items: ContractorTabContractRow[] = useMemo(
    () => (queryData?.items ?? []) as unknown as ContractorTabContractRow[],
    [queryData],
  );
  const totalCount: number = queryData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    contractorId,
    wizardOpen,
    setWizardOpen,
    page,
    setPage,
    pageSize,
    items,
    totalCount,
    totalPages,
    isLoading: contractsQuery.isLoading,
  } as const;
}

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { usePortalTRPC } from '../../../providers/trpc-provider.js';

export function usePortalContractDetail(id: string) {
  const trpc = usePortalTRPC();
  const contractQuery = useQuery({
    ...trpc.portal.getContract.queryOptions({ id }),
    enabled: Boolean(id),
  });

  const handleRetry = useCallback(() => {
    void contractQuery.refetch();
  }, [contractQuery]);

  const errorCode = (contractQuery.error as { data?: { code?: string } } | null | undefined)?.data
    ?.code;
  const isNotFound = errorCode === 'NOT_FOUND';

  return {
    contract: contractQuery.data,
    isLoading: contractQuery.isPending,
    isError: contractQuery.isError,
    isNotFound,
    handleRetry,
  } as const;
}

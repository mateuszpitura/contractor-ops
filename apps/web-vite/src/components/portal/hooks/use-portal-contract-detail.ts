import { useEntityDetailQuery } from '../../../hooks/use-entity-detail-query.js';
import { usePortalTRPC } from '../../../providers/trpc-provider.js';

export function usePortalContractDetail(id: string) {
  const trpc = usePortalTRPC();
  const {
    data: contract,
    handleRetry,
    isNotFound,
    isLoading,
    isError,
  } = useEntityDetailQuery({
    ...trpc.portal.getContract.queryOptions({ id }),
    enabled: Boolean(id),
  });

  return {
    contract,
    isLoading,
    isError,
    isNotFound,
    handleRetry,
  } as const;
}

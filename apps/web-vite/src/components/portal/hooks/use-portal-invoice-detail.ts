import { useEntityDetailQuery } from '../../../hooks/use-entity-detail-query.js';
import { usePortalTRPC } from '../../../providers/trpc-provider.js';

export function usePortalInvoiceDetail(id: string) {
  const trpc = usePortalTRPC();
  const {
    data: invoice,
    handleRetry,
    isNotFound,
    isLoading,
    isError,
  } = useEntityDetailQuery({
    ...trpc.portal.getInvoice.queryOptions({ id }),
    enabled: Boolean(id),
  });

  return {
    invoice,
    isLoading,
    isError,
    isNotFound,
    handleRetry,
  } as const;
}

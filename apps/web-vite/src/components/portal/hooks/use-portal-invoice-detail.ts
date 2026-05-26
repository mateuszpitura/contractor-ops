import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { usePortalTRPC } from '../../../providers/trpc-provider.js';

export function usePortalInvoiceDetail(id: string) {
  const trpc = usePortalTRPC();
  const invoiceQuery = useQuery({
    ...trpc.portal.getInvoice.queryOptions({ id }),
    enabled: Boolean(id),
  });

  const handleRetry = useCallback(() => {
    void invoiceQuery.refetch();
  }, [invoiceQuery]);

  const errorCode = (invoiceQuery.error as { data?: { code?: string } } | null | undefined)?.data
    ?.code;
  const isNotFound = errorCode === 'NOT_FOUND';

  return {
    invoice: invoiceQuery.data,
    isLoading: invoiceQuery.isPending,
    isError: invoiceQuery.isError,
    isNotFound,
    handleRetry,
  } as const;
}

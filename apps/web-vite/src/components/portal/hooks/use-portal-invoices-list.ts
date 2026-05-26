import { useQuery } from '@tanstack/react-query';

import { usePortalTRPC } from '../../../providers/trpc-provider.js';

export function usePortalInvoicesList() {
  const trpc = usePortalTRPC();
  const invoicesQuery = useQuery(trpc.portal.listInvoices.queryOptions());

  return {
    invoices: invoicesQuery.data,
    isLoading: invoicesQuery.isPending,
  } as const;
}

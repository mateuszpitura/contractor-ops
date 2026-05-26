import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { InvoiceRow } from '../../invoices/invoice-table/columns.js';

export function useContractorTabInvoices(contractorId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const invoicesQuery = useQuery(
    trpc.invoice.list.queryOptions({
      page,
      pageSize,
      sortBy: 'receivedAt',
      sortOrder: 'desc',
      filters: {
        contractorId,
      },
    }),
  );

  const data: InvoiceRow[] = useMemo(() => {
    const result = invoicesQuery.data as { items: InvoiceRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [invoicesQuery.data]);

  const totalRows = useMemo(() => {
    const result = invoicesQuery.data as { items: unknown[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [invoicesQuery.data]);

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  const handleUploadComplete = useCallback(() => {
    setUploadOpen(false);
    void queryClient.invalidateQueries({
      queryKey: trpc.invoice.list.queryKey(),
    });
  }, [queryClient, trpc.invoice.list]);

  return {
    contractorId,
    uploadOpen,
    setUploadOpen,
    page,
    setPage,
    data,
    totalRows,
    totalPages,
    isLoading: invoicesQuery.isLoading,
    handleUploadComplete,
  } as const;
}

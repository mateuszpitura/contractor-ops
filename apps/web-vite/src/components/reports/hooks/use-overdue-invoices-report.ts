import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { DEFAULT_REPORT_PAGE_SIZE } from '../report-constants.js';

export type OverdueRow = {
  invoiceId: string;
  invoiceNumber: string;
  contractorId: string | null;
  contractorName: string;
  amountMinor: number;
  currency: string;
  dueDate: string;
  daysOverdue: number;
  status: string;
};

export function useOverdueInvoicesReport() {
  const trpc = useTRPC();
  const t = useTranslations('Reports');
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_REPORT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState('dueDate');
  const [sortOrder, setSortOrder] = useState('asc');

  const tableQuery = useQuery(
    trpc.report.overdueInvoices.queryOptions({
      page,
      pageSize,
      sortBy: sortBy as 'dueDate' | 'amount' | 'contractorName',
      sortOrder: sortOrder as 'asc' | 'desc',
    }),
  );

  const exportMutation = useMutation(
    trpc.report.exportOverdueInvoices.mutationOptions({
      onSuccess: () => {
        toast.success(t('exportQueued'));
        queryClient.invalidateQueries(trpc.report.pathFilter());
      },
      onError: () => {
        toast.error(t('exportError'));
      },
    }),
  );

  const tableData = useMemo(() => {
    const result = tableQuery.data as { items: OverdueRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [tableQuery.data]);

  const totalCount = useMemo(() => {
    const result = tableQuery.data as { items: OverdueRow[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [tableQuery.data]);

  const handleSortChange = useCallback((newSortBy: string, newSortOrder: string) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  }, []);

  const handleExportPage = useCallback(() => {
    exportMutation.mutate(undefined as never);
  }, [exportMutation]);

  const handleExportAll = useCallback(() => {
    exportMutation.mutate(undefined as never);
  }, [exportMutation]);

  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);

  return {
    page,
    setPage,
    pageSize,
    handlePageSizeChange,
    sortBy,
    sortOrder,
    tableData,
    totalCount,
    tableQuery,
    exportMutation,
    handleSortChange,
    handleExportPage,
    handleExportAll,
    handleTableRetry: () => void tableQuery.refetch(),
  } as const;
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { DEFAULT_REPORT_PAGE_SIZE } from '../report-constants.js';

export type ExpiringRow = {
  contractId: string;
  contractTitle: string;
  contractorId: string;
  contractorName: string;
  endDate: string;
  daysRemaining: number;
  status: string;
};

export function useExpiringContractsReport() {
  const trpc = useTRPC();
  const t = useTranslations('Reports');
  const queryClient = useQueryClient();

  const [days, setDays] = useState<'30' | '60' | '90'>('30');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_REPORT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState('endDate');
  const [sortOrder, setSortOrder] = useState('asc');

  const tableQuery = useQuery(
    trpc.report.expiringContracts.queryOptions({
      days,
      page,
      pageSize,
      sortBy: sortBy as 'endDate' | 'contractorName' | 'title',
      sortOrder: sortOrder as 'asc' | 'desc',
    }),
  );

  const chartQuery = useQuery(trpc.report.expiringContractsChart.queryOptions({ days }));

  const exportMutation = useMutation(
    trpc.report.exportExpiringContracts.mutationOptions({
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
    const result = tableQuery.data as { items: ExpiringRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [tableQuery.data]);

  const totalCount = useMemo(() => {
    const result = tableQuery.data as { items: ExpiringRow[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [tableQuery.data]);

  const chartData = useMemo(() => {
    return (chartQuery.data ?? []) as Array<{
      bucket: string;
      count: number;
    }>;
  }, [chartQuery.data]);

  const handleSortChange = useCallback((newSortBy: string, newSortOrder: string) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  }, []);

  const handleDaysChange = useCallback((d: '30' | '60' | '90') => {
    setDays(d);
    setPage(1);
  }, []);

  const handleExportPage = useCallback(() => {
    exportMutation.mutate({ days });
  }, [exportMutation, days]);

  const handleExportAll = useCallback(() => {
    exportMutation.mutate({ days });
  }, [exportMutation, days]);

  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(1);
  }, []);

  return {
    days,
    page,
    setPage,
    pageSize,
    handlePageSizeChange,
    sortBy,
    sortOrder,
    tableData,
    totalCount,
    chartData,
    tableQuery,
    chartQuery,
    exportMutation,
    handleSortChange,
    handleDaysChange,
    handleExportPage,
    handleExportAll,
    handleChartRetry: () => void chartQuery.refetch(),
    handleTableRetry: () => void tableQuery.refetch(),
  } as const;
}

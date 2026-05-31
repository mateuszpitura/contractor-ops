import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { DEFAULT_REPORT_PAGE_SIZE } from '../report-constants.js';

export type SpendContractorRow = {
  contractorId: string;
  contractorName: string;
  invoiceCount: number;
  totalMinor: number;
  avgMinor: number;
  lastPaidAt: string | null;
};

export function useSpendContractorReport(dateFrom: string, dateTo: string) {
  const trpc = useTRPC();
  const t = useTranslations('Reports');
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_REPORT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState('totalSpend');
  const [sortOrder, setSortOrder] = useState('desc');
  const [drillDownContractorId, setDrillDownContractorId] = useState<string | null>(null);

  const tableQuery = useQuery(
    trpc.report.spendByContractor.queryOptions({
      dateFrom,
      dateTo,
      page,
      pageSize,
      sortBy: sortBy as 'totalSpend' | 'invoiceCount' | 'contractorName',
      sortOrder: sortOrder as 'asc' | 'desc',
      contractorId: drillDownContractorId ?? undefined,
    }),
  );

  const chartQuery = useQuery(
    trpc.report.spendByContractorChart.queryOptions({ dateFrom, dateTo }),
  );

  const exportMutation = useMutation(
    trpc.report.exportSpendByContractor.mutationOptions({
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
    const result = tableQuery.data as { items: SpendContractorRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [tableQuery.data]);

  const totalCount = useMemo(() => {
    const result = tableQuery.data as { items: SpendContractorRow[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [tableQuery.data]);

  const chartData = useMemo(() => {
    return (chartQuery.data ?? []) as Array<{
      contractorId: string;
      contractorName: string;
      totalMinor: number;
    }>;
  }, [chartQuery.data]);

  const drillDownName = useMemo(() => {
    if (!drillDownContractorId) return null;
    const item = chartData.find(d => d.contractorId === drillDownContractorId);
    return item?.contractorName ?? drillDownContractorId;
  }, [drillDownContractorId, chartData]);

  const grandTotal = useMemo(() => {
    return tableData.reduce((sum, row) => sum + row.totalMinor, 0);
  }, [tableData]);

  const handleSortChange = useCallback((newSortBy: string, newSortOrder: string) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  }, []);

  const handleDrillDown = useCallback(
    (contractorId: string) => {
      setDrillDownContractorId(contractorId === drillDownContractorId ? null : contractorId);
      setPage(1);
    },
    [drillDownContractorId],
  );

  const handleClearDrillDown = useCallback(() => {
    setDrillDownContractorId(null);
    setPage(1);
  }, []);

  const handleExportPage = useCallback(() => {
    exportMutation.mutate({
      dateFrom,
      dateTo,
      contractorId: drillDownContractorId ?? undefined,
    });
  }, [exportMutation, dateFrom, dateTo, drillDownContractorId]);

  const handleExportAll = useCallback(() => {
    exportMutation.mutate({ dateFrom, dateTo });
  }, [exportMutation, dateFrom, dateTo]);

  const handleChartRetry = useCallback(() => {
    void chartQuery.refetch();
  }, [chartQuery]);

  const handleTableRetry = useCallback(() => {
    void tableQuery.refetch();
  }, [tableQuery]);

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
    drillDownContractorId,
    drillDownName,
    tableData,
    totalCount,
    chartData,
    grandTotal,
    tableQuery,
    chartQuery,
    exportMutation,
    handleSortChange,
    handleDrillDown,
    handleClearDrillDown,
    handleExportPage,
    handleExportAll,
    handleChartRetry,
    handleTableRetry,
  } as const;
}

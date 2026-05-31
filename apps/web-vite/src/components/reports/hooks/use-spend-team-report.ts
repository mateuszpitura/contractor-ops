import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { DEFAULT_REPORT_PAGE_SIZE } from '../report-constants.js';

export type TeamSpendRow = {
  teamId: string | null;
  teamName: string | null;
  contractorCount: number;
  invoiceCount: number;
  totalMinor: number;
};

export function useSpendTeamReport(dateFrom: string, dateTo: string) {
  const trpc = useTRPC();
  const t = useTranslations('Reports');
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_REPORT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState('totalSpend');
  const [sortOrder, setSortOrder] = useState('desc');
  const [drillDownTeamId, setDrillDownTeamId] = useState<string | null>(null);

  const tableQuery = useQuery(
    trpc.report.spendByTeam.queryOptions({
      dateFrom,
      dateTo,
      page,
      pageSize,
      sortBy: sortBy as 'totalSpend' | 'invoiceCount' | 'teamName',
      sortOrder: sortOrder as 'asc' | 'desc',
    }),
  );

  const chartQuery = useQuery(trpc.report.spendByTeamChart.queryOptions({ dateFrom, dateTo }));

  const exportMutation = useMutation(
    trpc.report.exportSpendByTeam.mutationOptions({
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
    const result = tableQuery.data as { items: TeamSpendRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [tableQuery.data]);

  const totalCount = useMemo(() => {
    const result = tableQuery.data as { items: TeamSpendRow[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [tableQuery.data]);

  const chartData = useMemo(() => {
    const raw = (chartQuery.data ?? []) as Array<{
      teamId: string | null;
      teamName: string | null;
      totalMinor: number;
    }>;
    return raw.map(item => ({
      ...item,
      teamName: item.teamName ?? t('unassignedTeam'),
    }));
  }, [chartQuery.data, t]);

  const drillDownName = useMemo(() => {
    if (!drillDownTeamId) return null;
    const item = tableData.find(d => d.teamId === drillDownTeamId);
    return item?.teamName ?? t('unassignedTeam');
  }, [drillDownTeamId, tableData, t]);

  const grandTotal = useMemo(() => {
    return tableData.reduce((sum, row) => sum + row.totalMinor, 0);
  }, [tableData]);

  const handleSortChange = useCallback((newSortBy: string, newSortOrder: string) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  }, []);

  const handleDrillDown = useCallback(
    (teamId: string) => {
      setDrillDownTeamId(teamId === drillDownTeamId ? null : teamId);
      setPage(1);
    },
    [drillDownTeamId],
  );

  const handleClearDrillDown = useCallback(() => {
    setDrillDownTeamId(null);
    setPage(1);
  }, []);

  const handleExportPage = useCallback(() => {
    exportMutation.mutate({ dateFrom, dateTo });
  }, [exportMutation, dateFrom, dateTo]);

  const handleExportAll = useCallback(() => {
    exportMutation.mutate({ dateFrom, dateTo });
  }, [exportMutation, dateFrom, dateTo]);

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
    drillDownTeamId,
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
    handleChartRetry: () => void chartQuery.refetch(),
    handleTableRetry: () => void tableQuery.refetch(),
  } as const;
}

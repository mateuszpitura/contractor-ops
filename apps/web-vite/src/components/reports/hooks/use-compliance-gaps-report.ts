import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { DEFAULT_REPORT_PAGE_SIZE } from '../report-constants.js';

export type ComplianceRow = {
  contractorId: string;
  contractorName: string;
  missingDocuments: number;
  contractStatus: string;
  overdueTasks: number;
  health: 'red' | 'yellow' | 'green';
};

export function useComplianceGapsReport() {
  const trpc = useTRPC();
  const t = useTranslations('Reports');
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_REPORT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState('health');
  const [sortOrder, setSortOrder] = useState('desc');
  const [drillDownHealth, setDrillDownHealth] = useState<string | null>(null);

  const tableQuery = useQuery(
    trpc.report.complianceGaps.queryOptions({
      page,
      pageSize,
      sortBy: sortBy as 'health' | 'contractorName' | 'missingDocs',
      sortOrder: sortOrder as 'asc' | 'desc',
    }),
  );

  const chartQuery = useQuery(trpc.report.complianceGapsChart.queryOptions());

  const exportMutation = useMutation(
    trpc.report.exportComplianceGaps.mutationOptions({
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
    const result = tableQuery.data as { items: ComplianceRow[]; total: number } | undefined;
    let items = result?.items ?? [];

    if (drillDownHealth) {
      const healthMap: Record<string, string> = {
        critical: 'red',
        warning: 'yellow',
        ok: 'green',
      };
      const mapped = healthMap[drillDownHealth] ?? drillDownHealth;
      items = items.filter(item => item.health === mapped);
    }

    return items;
  }, [tableQuery.data, drillDownHealth]);

  const totalCount = useMemo(() => {
    if (drillDownHealth) return tableData.length;
    const result = tableQuery.data as { items: ComplianceRow[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [tableQuery.data, drillDownHealth, tableData.length]);

  const chartData = useMemo(() => {
    const data = chartQuery.data as { critical: number; warning: number; ok: number } | undefined;
    if (!data) return [];
    return [data];
  }, [chartQuery.data]);

  const drillDownLabel = useMemo(() => {
    if (!drillDownHealth) return null;
    const labels: Record<string, string> = {
      critical: t('healthCritical'),
      warning: t('healthWarning'),
      ok: t('healthOk'),
    };
    return labels[drillDownHealth] ?? drillDownHealth;
  }, [drillDownHealth, t]);

  const handleSortChange = useCallback((newSortBy: string, newSortOrder: string) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  }, []);

  const handleDrillDown = useCallback(
    (healthId: string) => {
      setDrillDownHealth(healthId === drillDownHealth ? null : healthId);
      setPage(1);
    },
    [drillDownHealth],
  );

  const handleClearDrillDown = useCallback(() => {
    setDrillDownHealth(null);
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
    drillDownHealth,
    drillDownLabel,
    tableData,
    totalCount,
    chartData,
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

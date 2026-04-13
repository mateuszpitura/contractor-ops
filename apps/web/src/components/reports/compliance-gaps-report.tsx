'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';
import { DrillDownBreadcrumb } from './drill-down-breadcrumb';
import { downloadBase64File, ExportButtons } from './export-buttons';
import { ReportChart } from './report-chart';
import { ReportTable } from './report-table';

interface ComplianceGapsReportProps {
  dateFrom: string;
  dateTo: string;
}

type ComplianceRow = {
  contractorId: string;
  contractorName: string;
  missingDocuments: number;
  contractStatus: string;
  overdueTasks: number;
  health: 'red' | 'yellow' | 'green';
};

const HEALTH_BADGE: Record<
  string,
  { variant: 'destructive' | 'secondary' | 'outline'; labelKey: string }
> = {
  red: { variant: 'destructive', labelKey: 'healthCritical' },
  yellow: { variant: 'secondary', labelKey: 'healthWarning' },
  green: { variant: 'outline', labelKey: 'healthOk' },
};

export function ComplianceGapsReport({
  dateFrom: _dateFrom,
  dateTo: _dateTo,
}: ComplianceGapsReportProps) {
  const t = useTranslations('Reports');
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('health');
  const [sortOrder, setSortOrder] = useState('desc');
  const [drillDownHealth, setDrillDownHealth] = useState<string | null>(null);

  const tableQuery = useQuery(
    trpc.report.complianceGaps.queryOptions({
      page,
      pageSize: 20,
      sortBy: sortBy as 'health' | 'contractorName' | 'missingDocs',
      sortOrder: sortOrder as 'asc' | 'desc',
    }),
  );

  const chartQuery = useQuery(trpc.report.complianceGapsChart.queryOptions());

  const exportMutation = useMutation(
    trpc.report.exportComplianceGaps.mutationOptions({
      onSuccess: data => {
        const result = data as {
          data: string;
          filename: string;
          mimeType: string;
        };
        downloadBase64File(result.data, result.filename, result.mimeType);
        toast.success(t('exportSuccess', { count: tableData.length }));
      },
      onError: () => {
        toast.error(t('exportError'));
      },
    }),
  );

  const tableData = useMemo(() => {
    const result = tableQuery.data as { items: ComplianceRow[]; totalCount: number } | undefined;
    let items = result?.items ?? [];

    // Client-side filter by health when drilled down
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
    const result = tableQuery.data as { items: ComplianceRow[]; totalCount: number } | undefined;
    return result?.totalCount ?? 0;
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

  const columns: ColumnDef<ComplianceRow>[] = useMemo(
    () => [
      {
        accessorKey: 'contractorName',
        header: t('contractor'),
        enableSorting: true,
      },
      {
        accessorKey: 'missingDocuments',
        header: t('missingDocs'),
        enableSorting: true,
      },
      {
        accessorKey: 'contractStatus',
        header: t('contractStatus'),
        cell: ({ getValue }) => <Badge variant="secondary">{getValue<string>()}</Badge>,
      },
      {
        accessorKey: 'overdueTasks',
        header: t('overdueTasks'),
      },
      {
        accessorKey: 'health',
        header: t('health'),
        enableSorting: true,
        cell: ({ getValue }) => {
          const health = getValue<string>();
          const config = HEALTH_BADGE[health] ?? HEALTH_BADGE.green;
          return (
            <Badge variant={config.variant}>{t(config.labelKey as Parameters<typeof t>[0])}</Badge>
          );
        },
      },
    ],
    [t],
  );

  const handleSortChange = (newSortBy: string, newSortOrder: string) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  };

  const handleDrillDown = (healthId: string) => {
    setDrillDownHealth(healthId === drillDownHealth ? null : healthId);
    setPage(1);
  };

  const handleClearDrillDown = () => {
    setDrillDownHealth(null);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <ReportChart
        type="pie"
        data={chartData}
        dataKey="value"
        nameKey="name"
        activeId={drillDownHealth ?? undefined}
        onSegmentClick={handleDrillDown}
        isLoading={chartQuery.isLoading}
      />

      <DrillDownBreadcrumb
        segments={[
          { label: t('all') },
          ...(drillDownLabel ? [{ label: drillDownLabel, id: drillDownHealth as string }] : []),
        ]}
        onClear={handleClearDrillDown}
      />

      <ReportTable<ComplianceRow>
        columns={columns}
        data={tableData}
        totalCount={totalCount}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        onSortChange={handleSortChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onRowClick={row => router.push(`/contractors/${row.contractorId}`)}
        isLoading={tableQuery.isLoading}
        emptyIcon={<ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground/50" />}
        emptyTitle={t('emptyComplianceGaps')}
        emptyDescription={t('emptyComplianceGapsBody')}
      />

      <ExportButtons
        onExportPage={() => exportMutation.mutate()}
        onExportAll={() => exportMutation.mutate()}
        isExporting={exportMutation.isPending}
      />
    </div>
  );
}

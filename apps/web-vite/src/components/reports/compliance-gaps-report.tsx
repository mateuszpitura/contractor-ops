import { ComplianceGapsIllustration, SectionLabel } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import type { ColumnDef } from '@tanstack/react-table';
import { ShieldAlert } from 'lucide-react';
import { useMemo } from 'react';

import { useRouter } from '../../i18n/navigation.js';
import { tKey } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { DrillDownBreadcrumb } from './drill-down-breadcrumb.js';
import { ExportButtons } from './export-buttons.js';
import type { ComplianceRow, useComplianceGapsReport } from './hooks/use-compliance-gaps-report.js';
import { ReportChart } from './report-chart.js';
import { ReportTable } from './report-table.js';

const HEALTH_BADGE: Record<
  string,
  { variant: 'destructive' | 'secondary' | 'outline'; labelKey: string }
> = {
  red: { variant: 'destructive', labelKey: 'healthCritical' },
  yellow: { variant: 'secondary', labelKey: 'healthWarning' },
  green: { variant: 'outline', labelKey: 'healthOk' },
};

interface ComplianceGapsReportProps {
  report: ReturnType<typeof useComplianceGapsReport>;
}

export function ComplianceGapsReport({ report }: ComplianceGapsReportProps) {
  const t = useTranslations('Reports');
  const router = useRouter();

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
          return <Badge variant={config.variant}>{tKey(t, config.labelKey)}</Badge>;
        },
      },
    ],
    [t],
  );

  return (
    <div className="space-y-4">
      <ReportChart
        type="pie"
        data={report.chartData}
        dataKey="value"
        nameKey="name"
        activeId={report.drillDownHealth ?? undefined}
        onSegmentClick={report.handleDrillDown}
        isLoading={report.chartQuery.isLoading}
        isError={report.chartQuery.isError}
        onRetry={report.handleChartRetry}
      />

      <DrillDownBreadcrumb
        segments={[
          { label: t('all') },
          ...(report.drillDownLabel
            ? [{ label: report.drillDownLabel, id: report.drillDownHealth as string }]
            : []),
        ]}
        onClear={report.handleClearDrillDown}
      />

      <SectionLabel icon={ShieldAlert}>{t('complianceGaps')}</SectionLabel>
      <ReportTable<ComplianceRow>
        columns={columns}
        data={report.tableData}
        totalCount={report.totalCount}
        page={report.page}
        pageSize={report.pageSize}
        onPageChange={report.setPage}
        onPageSizeChange={report.handlePageSizeChange}
        onSortChange={report.handleSortChange}
        sortBy={report.sortBy}
        sortOrder={report.sortOrder}
        onRowClick={row => router.push(`/contractors/${row.contractorId}`)}
        isLoading={report.tableQuery.isLoading}
        isFetching={report.tableQuery.isFetching}
        isError={report.tableQuery.isError}
        onRetry={report.handleTableRetry}
        emptyIcon={<ComplianceGapsIllustration className="mx-auto h-16 w-16 text-primary/60" />}
        emptyTitle={t('emptyComplianceGaps')}
        emptyDescription={t('emptyComplianceGapsBody')}
      />

      <ExportButtons
        onExportPage={report.handleExportPage}
        onExportAll={report.handleExportAll}
        isExporting={report.exportMutation.isPending}
      />
    </div>
  );
}

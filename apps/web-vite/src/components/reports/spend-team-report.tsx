import { formatMinorAsCurrency } from '@contractor-ops/shared';
import { SectionLabel, SpendReportIllustration } from '@contractor-ops/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Users } from 'lucide-react';
import { useMemo } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { DrillDownBreadcrumb } from './drill-down-breadcrumb.js';
import { ExportButtons } from './export-buttons.js';
import type { TeamSpendRow, useSpendTeamReport } from './hooks/use-spend-team-report.js';
import { ReportChart } from './report-chart.js';
import { ReportTable } from './report-table.js';

function formatCurrency(minor: number): string {
  return formatMinorAsCurrency(minor, 'PLN', 'pl-PL');
}

interface SpendTeamReportProps {
  report: ReturnType<typeof useSpendTeamReport>;
}

export function SpendTeamReport({ report }: SpendTeamReportProps) {
  const t = useTranslations('Reports');

  const columns: ColumnDef<TeamSpendRow>[] = useMemo(
    () => [
      {
        accessorKey: 'teamName',
        header: t('team'),
        enableSorting: true,
        cell: ({ getValue }) => getValue<string | null>() ?? t('unassignedTeam'),
      },
      {
        accessorKey: 'contractorCount',
        header: t('contractors'),
        enableSorting: false,
      },
      {
        accessorKey: 'invoiceCount',
        header: t('invoices'),
        enableSorting: true,
      },
      {
        accessorKey: 'totalMinor',
        header: t('totalSpend'),
        enableSorting: true,
        cell: ({ getValue }) => formatCurrency(getValue<number>()),
      },
      {
        id: 'budgetPercent',
        header: t('budgetPercent'),
        cell: () => '-',
      },
    ],
    [t],
  );

  return (
    <div className="space-y-4">
      <ReportChart
        type="bar-horizontal"
        data={report.chartData}
        dataKey="totalMinor"
        nameKey="teamName"
        idKey="teamId"
        activeId={report.drillDownTeamId ?? undefined}
        onSegmentClick={report.handleDrillDown}
        isLoading={report.chartQuery.isLoading}
        isError={report.chartQuery.isError}
        onRetry={report.handleChartRetry}
      />

      <DrillDownBreadcrumb
        segments={[
          { label: t('all') },
          ...(report.drillDownName
            ? [{ label: report.drillDownName, id: report.drillDownTeamId as string }]
            : []),
        ]}
        onClear={report.handleClearDrillDown}
      />

      <SectionLabel icon={Users}>{t('spendByTeam')}</SectionLabel>
      <ReportTable<TeamSpendRow>
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
        isLoading={report.tableQuery.isLoading}
        isFetching={report.tableQuery.isFetching}
        isError={report.tableQuery.isError}
        onRetry={report.handleTableRetry}
        emptyIcon={<SpendReportIllustration className="mx-auto h-16 w-16 text-primary/60" />}
        emptyTitle={t('emptySpendTeam')}
        emptyDescription={t('emptySpendTeamBody')}
        grandTotalLabel={t('grandTotal')}
        grandTotalValue={formatCurrency(report.grandTotal)}
      />

      <ExportButtons
        onExportPage={report.handleExportPage}
        onExportAll={report.handleExportAll}
        isExporting={report.exportMutation.isPending}
      />
    </div>
  );
}

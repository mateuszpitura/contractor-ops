import { formatMinorAsCurrency } from '@contractor-ops/shared';
import { SectionLabel, SpendReportIllustration } from '@contractor-ops/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { TrendingUp } from 'lucide-react';
import { useCallback, useMemo } from 'react';

import { useRouter } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useDateFormatter } from '../../lib/format/use-date-formatter.js';
import { DrillDownBreadcrumb } from './drill-down-breadcrumb.js';
import { ExportButtons } from './export-buttons.js';
import type {
  SpendContractorRow,
  useSpendContractorReport,
} from './hooks/use-spend-contractor-report.js';
import { ReportChart } from './report-chart.js';
import { ReportTable } from './report-table.js';

function formatCurrency(minor: number): string {
  return formatMinorAsCurrency(minor, 'PLN', 'pl-PL');
}

interface SpendContractorReportProps {
  report: ReturnType<typeof useSpendContractorReport>;
}

export function SpendContractorReport({ report }: SpendContractorReportProps) {
  const t = useTranslations('Reports');
  const router = useRouter();
  const { formatDate } = useDateFormatter();

  const handleRowClick = useCallback(
    (row: SpendContractorRow) => router.push(`/contractors/${row.contractorId}`),
    [router],
  );

  const columns: ColumnDef<SpendContractorRow>[] = useMemo(
    () => [
      {
        accessorKey: 'contractorName',
        header: t('contractor'),
        enableSorting: true,
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
        accessorKey: 'avgMinor',
        header: t('avgInvoice'),
        cell: ({ getValue }) => formatCurrency(getValue<number>()),
      },
      {
        accessorKey: 'lastPaidAt',
        header: t('lastPayment'),
        cell: ({ getValue }) => formatDate(getValue<string | null>()),
      },
    ],
    [t, formatDate],
  );

  return (
    <div className="space-y-4">
      <ReportChart
        type="bar-horizontal"
        data={report.chartData}
        dataKey="totalMinor"
        nameKey="contractorName"
        idKey="contractorId"
        activeId={report.drillDownContractorId ?? undefined}
        onSegmentClick={report.handleDrillDown}
        isLoading={report.chartQuery.isLoading}
        isError={report.chartQuery.isError}
        onRetry={report.handleChartRetry}
      />

      <DrillDownBreadcrumb
        segments={[
          { label: t('all') },
          ...(report.drillDownName
            ? [{ label: report.drillDownName, id: report.drillDownContractorId as string }]
            : []),
        ]}
        onClear={report.handleClearDrillDown}
      />

      <SectionLabel icon={TrendingUp}>{t('spendByContractor')}</SectionLabel>
      <ReportTable<SpendContractorRow>
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
        onRowClick={handleRowClick}
        isLoading={report.tableQuery.isLoading}
        isFetching={report.tableQuery.isFetching}
        isError={report.tableQuery.isError}
        onRetry={report.handleTableRetry}
        emptyIcon={<SpendReportIllustration className="mx-auto h-16 w-16 text-primary/60" />}
        emptyTitle={t('emptySpendContractor')}
        emptyDescription={t('emptySpendContractorBody')}
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

import { formatMinorAsCurrency } from '@contractor-ops/shared';
import { OverdueInvoicesIllustration, SectionLabel } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertCircle } from 'lucide-react';
import { useMemo } from 'react';

import { useRouter } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useDateFormatter } from '../../lib/format/use-date-formatter.js';
import { ExportButtons } from './export-buttons.js';
import type { OverdueRow, useOverdueInvoicesReport } from './hooks/use-overdue-invoices-report.js';
import { ReportTable } from './report-table.js';

function formatCurrency(minor: number): string {
  return formatMinorAsCurrency(minor, 'PLN', 'pl-PL');
}

interface OverdueInvoicesReportProps {
  report: ReturnType<typeof useOverdueInvoicesReport>;
}

export function OverdueInvoicesReport({ report }: OverdueInvoicesReportProps) {
  const t = useTranslations('Reports');
  const router = useRouter();
  const { formatDate } = useDateFormatter();

  const columns: ColumnDef<OverdueRow>[] = useMemo(
    () => [
      {
        accessorKey: 'invoiceNumber',
        header: t('invoiceNumber'),
        enableSorting: false,
      },
      {
        accessorKey: 'contractorName',
        header: t('contractor'),
        enableSorting: true,
      },
      {
        accessorKey: 'amountMinor',
        header: t('amount'),
        enableSorting: true,
        cell: ({ row }) => `${formatCurrency(row.original.amountMinor)} ${row.original.currency}`,
      },
      {
        accessorKey: 'dueDate',
        header: t('dueDate'),
        enableSorting: true,
        cell: ({ getValue }) => formatDate(getValue<string>()),
      },
      {
        accessorKey: 'daysOverdue',
        header: t('daysOverdue'),
        cell: ({ getValue }) => {
          const days = getValue<number>();
          return <span className={days > 30 ? 'font-medium text-destructive' : ''}>{days}</span>;
        },
      },
      {
        accessorKey: 'status',
        header: t('status'),
        cell: ({ getValue }) => <Badge variant="secondary">{getValue<string>()}</Badge>,
      },
    ],
    [t, formatDate],
  );

  return (
    <div className="space-y-4">
      <SectionLabel icon={AlertCircle}>{t('overdueInvoices')}</SectionLabel>
      <ReportTable<OverdueRow>
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
        onRowClick={row => router.push(`/invoices/${row.invoiceId}`)}
        isLoading={report.tableQuery.isLoading}
        isFetching={report.tableQuery.isFetching}
        isError={report.tableQuery.isError}
        onRetry={report.handleTableRetry}
        emptyIcon={<OverdueInvoicesIllustration className="mx-auto h-16 w-16 text-primary/60" />}
        emptyTitle={t('emptyOverdueInvoices')}
        emptyDescription={t('emptyOverdueInvoicesBody')}
      />

      <ExportButtons
        onExportPage={report.handleExportPage}
        onExportAll={report.handleExportAll}
        isExporting={report.exportMutation.isPending}
      />
    </div>
  );
}

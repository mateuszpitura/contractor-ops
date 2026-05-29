import { ExpiringContractsIllustration, SectionLabel } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarClock } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';

import { useRouter } from '../../i18n/navigation.js';
import { tKey } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { useDateFormatter } from '../../lib/format/use-date-formatter.js';
import { ExportButtons } from './export-buttons.js';
import type {
  ExpiringRow,
  useExpiringContractsReport,
} from './hooks/use-expiring-contracts-report.js';
import { ReportChart } from './report-chart.js';
import { ReportTable } from './report-table.js';

interface ExpiringContractsReportProps {
  report: ReturnType<typeof useExpiringContractsReport>;
}

type DaysOption = '30' | '60' | '90';

interface DaysButtonProps {
  value: DaysOption;
  active: boolean;
  label: string;
  onSelect: (value: DaysOption) => void;
}

const DaysButton = memo(function DaysButton({ value, active, label, onSelect }: DaysButtonProps) {
  const handleClick = useCallback(() => onSelect(value), [onSelect, value]);
  return (
    <Button variant={active ? 'default' : 'outline'} size="sm" onClick={handleClick}>
      {label}
    </Button>
  );
});

const noop = () => undefined;

export function ExpiringContractsReport({ report }: ExpiringContractsReportProps) {
  const t = useTranslations('Reports');
  const router = useRouter();
  const { formatDate } = useDateFormatter();

  const columns: ColumnDef<ExpiringRow>[] = useMemo(
    () => [
      {
        accessorKey: 'contractTitle',
        header: t('contract'),
        enableSorting: true,
      },
      {
        accessorKey: 'contractorName',
        header: t('contractor'),
        enableSorting: true,
      },
      {
        accessorKey: 'endDate',
        header: t('endDate'),
        enableSorting: true,
        cell: ({ getValue }) => formatDate(getValue<string>()),
      },
      {
        accessorKey: 'daysRemaining',
        header: t('daysLeft'),
        cell: ({ getValue }) => {
          const days = getValue<number>();
          return (
            <span
              className={
                days <= 7
                  ? 'text-destructive font-medium'
                  : days <= 30
                    ? 'text-warning font-medium'
                    : ''
              }>
              {days}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: t('status'),
        cell: ({ getValue }) => {
          const status = getValue<string>();
          return (
            <Badge variant={status === 'EXPIRING' ? 'destructive' : 'secondary'}>{status}</Badge>
          );
        },
      },
    ],
    [t, formatDate],
  );

  const handleRowClick = useCallback(
    (row: ExpiringRow) => router.push(`/contracts/${row.contractId}`),
    [router],
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['30', '60', '90'] as const).map(d => (
          <DaysButton
            key={d}
            value={d}
            active={report.days === d}
            label={tKey(t, `days${d}`)}
            onSelect={report.handleDaysChange}
          />
        ))}
      </div>

      <ReportChart
        type="bar-grouped"
        data={report.chartData}
        dataKey="count"
        nameKey="bucket"
        idKey="bucket"
        onSegmentClick={noop}
        isLoading={report.chartQuery.isLoading}
        isError={report.chartQuery.isError}
        onRetry={report.handleChartRetry}
      />

      <SectionLabel icon={CalendarClock}>{t('expiringContracts')}</SectionLabel>
      <ReportTable<ExpiringRow>
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
        emptyIcon={<ExpiringContractsIllustration className="mx-auto h-16 w-16 text-primary/60" />}
        emptyTitle={t('emptyExpiringContracts')}
        emptyDescription={t('emptyExpiringContractsBody')}
      />

      <ExportButtons
        onExportPage={report.handleExportPage}
        onExportAll={report.handleExportAll}
        isExporting={report.exportMutation.isPending}
      />
    </div>
  );
}

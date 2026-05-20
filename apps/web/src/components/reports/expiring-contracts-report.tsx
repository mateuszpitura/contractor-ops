'use client';

import { ExpiringContractsIllustration, SectionLabel } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarClock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { tKey } from '@/i18n/typed-keys';
import { useDateFormatter } from '@/lib/format/use-date-formatter';
import { trpc } from '@/trpc/init';
import { ExportButtons } from './export-buttons';
import { ReportChart } from './report-chart';
import { ReportTable } from './report-table';

interface ExpiringContractsReportProps {
  dateFrom: string;
  dateTo: string;
}

type ExpiringRow = {
  contractId: string;
  contractTitle: string;
  contractorId: string;
  contractorName: string;
  endDate: string;
  daysRemaining: number;
  status: string;
};

export function ExpiringContractsReport({
  dateFrom: _dateFrom,
  dateTo: _dateTo,
}: ExpiringContractsReportProps) {
  const t = useTranslations('Reports');
  const router = useRouter();
  const { formatDate } = useDateFormatter();

  const [days, setDays] = useState<'30' | '60' | '90'>('30');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('endDate');
  const [sortOrder, setSortOrder] = useState('asc');

  const tableQuery = useQuery(
    trpc.report.expiringContracts.queryOptions({
      days,
      page,
      pageSize: 20,
      sortBy: sortBy as 'endDate' | 'contractorName' | 'title',
      sortOrder: sortOrder as 'asc' | 'desc',
    }),
  );

  const chartQuery = useQuery(trpc.report.expiringContractsChart.queryOptions({ days }));
  const queryClient = useQueryClient();

  const exportMutation = useMutation(
    trpc.report.exportExpiringContracts.mutationOptions({
      // F-SCALE-01 — async export; user receives an email with the link.
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

  const handleSortChange = (newSortBy: string, newSortOrder: string) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Days selector */}
      <div className="flex gap-2">
        {(['30', '60', '90'] as const).map(d => (
          <Button
            key={d}
            variant={days === d ? 'default' : 'outline'}
            size="sm"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => {
              setDays(d);
              setPage(1);
            }}>
            {tKey(t, `days${d}`)}
          </Button>
        ))}
      </div>

      <ReportChart
        type="bar-grouped"
        data={chartData}
        dataKey="count"
        nameKey="bucket"
        idKey="bucket"
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onSegmentClick={() => undefined}
        isLoading={chartQuery.isLoading}
      />

      <SectionLabel icon={CalendarClock}>{t('expiringContracts')}</SectionLabel>
      <ReportTable<ExpiringRow>
        columns={columns}
        data={tableData}
        totalCount={totalCount}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onSortChange={handleSortChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onRowClick={row => router.push(`/contracts/${row.contractId}`)}
        isLoading={tableQuery.isLoading}
        emptyIcon={<ExpiringContractsIllustration className="mx-auto h-16 w-16 text-primary/60" />}
        emptyTitle={t('emptyExpiringContracts')}
        emptyDescription={t('emptyExpiringContractsBody')}
      />

      <ExportButtons
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onExportPage={() => exportMutation.mutate({ days })}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onExportAll={() => exportMutation.mutate({ days })}
        isExporting={exportMutation.isPending}
      />
    </div>
  );
}

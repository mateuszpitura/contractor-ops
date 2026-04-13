'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { FileWarning } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';
import { downloadBase64File, ExportButtons } from './export-buttons';
import { ReportChart } from './report-chart';
import { ReportTable } from './report-table';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

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

  const exportMutation = useMutation(
    trpc.report.exportExpiringContracts.mutationOptions({
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
    const result = tableQuery.data as { items: ExpiringRow[]; totalCount: number } | undefined;
    return result?.items ?? [];
  }, [tableQuery.data]);

  const totalCount = useMemo(() => {
    const result = tableQuery.data as { items: ExpiringRow[]; totalCount: number } | undefined;
    return result?.totalCount ?? 0;
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
    [t],
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
            {t(`days${d}` as Parameters<typeof t>[0])}
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
        emptyIcon={<FileWarning className="mx-auto h-10 w-10 text-muted-foreground/50" />}
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

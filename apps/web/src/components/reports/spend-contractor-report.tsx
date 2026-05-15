'use client';

import { SpendReportIllustration } from '@contractor-ops/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { useDateFormatter } from '@/lib/format/use-date-formatter';
import { trpc } from '@/trpc/init';
import { DrillDownBreadcrumb } from './drill-down-breadcrumb';
import { ExportButtons } from './export-buttons';
import { ReportChart } from './report-chart';
import { ReportTable } from './report-table';

function formatCurrency(minor: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

interface SpendContractorReportProps {
  dateFrom: string;
  dateTo: string;
}

type SpendRow = {
  contractorId: string;
  contractorName: string;
  invoiceCount: number;
  totalMinor: number;
  avgMinor: number;
  lastPaidAt: string | null;
};

export function SpendContractorReport({ dateFrom, dateTo }: SpendContractorReportProps) {
  const t = useTranslations('Reports');
  const router = useRouter();
  const { formatDate } = useDateFormatter();

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('totalSpend');
  const [sortOrder, setSortOrder] = useState('desc');
  const [drillDownContractorId, setDrillDownContractorId] = useState<string | null>(null);

  const tableQuery = useQuery(
    trpc.report.spendByContractor.queryOptions({
      dateFrom,
      dateTo,
      page,
      pageSize: 20,
      sortBy: sortBy as 'totalSpend' | 'invoiceCount' | 'contractorName',
      sortOrder: sortOrder as 'asc' | 'desc',
      contractorId: drillDownContractorId ?? undefined,
    }),
  );

  const chartQuery = useQuery(
    trpc.report.spendByContractorChart.queryOptions({ dateFrom, dateTo }),
  );
  const queryClient = useQueryClient();

  const exportMutation = useMutation(
    trpc.report.exportSpendByContractor.mutationOptions({
      // F-SCALE-01 — exports now run async via QStash; the mutation
      // returns `{ exportId, status: 'PENDING' }` and we surface a
      // "queued — check your email" toast. The download link arrives
      // by email and is also visible from the in-app exports panel.
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
    const result = tableQuery.data as { items: SpendRow[]; totalCount: number } | undefined;
    return result?.items ?? [];
  }, [tableQuery.data]);

  const totalCount = useMemo(() => {
    const result = tableQuery.data as { items: SpendRow[]; totalCount: number } | undefined;
    return result?.totalCount ?? 0;
  }, [tableQuery.data]);

  const chartData = useMemo(() => {
    return (chartQuery.data ?? []) as Array<{
      contractorId: string;
      contractorName: string;
      totalMinor: number;
    }>;
  }, [chartQuery.data]);

  const drillDownName = useMemo(() => {
    if (!drillDownContractorId) return null;
    const item = chartData.find(d => d.contractorId === drillDownContractorId);
    return item?.contractorName ?? drillDownContractorId;
  }, [drillDownContractorId, chartData]);

  const grandTotal = useMemo(() => {
    return tableData.reduce((sum, row) => sum + row.totalMinor, 0);
  }, [tableData]);

  const columns: ColumnDef<SpendRow>[] = useMemo(
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

  const handleSortChange = (newSortBy: string, newSortOrder: string) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  };

  const handleDrillDown = (contractorId: string) => {
    setDrillDownContractorId(contractorId === drillDownContractorId ? null : contractorId);
    setPage(1);
  };

  const handleClearDrillDown = () => {
    setDrillDownContractorId(null);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <ReportChart
        type="bar-horizontal"
        data={chartData}
        dataKey="totalMinor"
        nameKey="contractorName"
        idKey="contractorId"
        activeId={drillDownContractorId ?? undefined}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onSegmentClick={handleDrillDown}
        isLoading={chartQuery.isLoading}
      />

      <DrillDownBreadcrumb
        segments={[
          { label: t('all') },
          ...(drillDownName ? [{ label: drillDownName, id: drillDownContractorId as string }] : []),
        ]}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onClear={handleClearDrillDown}
      />

      <ReportTable<SpendRow>
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
        onRowClick={row => router.push(`/contractors/${row.contractorId}`)}
        isLoading={tableQuery.isLoading}
        emptyIcon={<SpendReportIllustration className="mx-auto h-16 w-16 text-primary/60" />}
        emptyTitle={t('emptySpendContractor')}
        emptyDescription={t('emptySpendContractorBody')}
        grandTotalLabel={t('grandTotal')}
        grandTotalValue={formatCurrency(grandTotal)}
      />

      <ExportButtons
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onExportPage={() =>
          exportMutation.mutate({
            dateFrom,
            dateTo,
            contractorId: drillDownContractorId ?? undefined,
          })
        }
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onExportAll={() => exportMutation.mutate({ dateFrom, dateTo })}
        isExporting={exportMutation.isPending}
      />
    </div>
  );
}

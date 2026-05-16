'use client';

import { AtelierTableShell } from '@contractor-ops/ui';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Inbox, Upload } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { DataTableBody } from '@/components/shared/data-table-body';
import { Button } from '@/components/ui/button';
import { Table, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';
import { IntakeFilterChips, parseFilterParam } from './intake-filter-chips';
import type { ProfileLevel } from './intake-profile-level-badge';
import { IntakeProfileLevelBadge } from './intake-profile-level-badge';
import type { IntakeStatus } from './intake-status-pill';
import { IntakeStatusPill } from './intake-status-pill';
import { IntakeUploadDialog } from './intake-upload-dialog';
import type { ValidationStatus } from './intake-validation-status-pill';
import { IntakeValidationStatusPill } from './intake-validation-status-pill';

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

interface IntakeRow {
  id: string;
  createdAt: string | Date;
  extractedSupplierName: string | null;
  extractedInvoiceNumber: string | null;
  extractedInvoiceDate: string | Date | null;
  extractedTotalMinor: number | null | string;
  extractedCurrency: string | null;
  extractedProfileLevel: ProfileLevel | null;
  status: IntakeStatus;
  validationStatus: ValidationStatus | null;
}

interface IntakeListProps {
  initialStatus?: string | null;
}

function formatTotalMinor(amountMinor: unknown, currency: string | null): string | null {
  if (amountMinor === null || amountMinor === undefined) return null;
  const minor = typeof amountMinor === 'string' ? Number(amountMinor) : Number(amountMinor);
  if (!Number.isFinite(minor)) return null;
  const safeCurrency = currency ?? 'EUR';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: safeCurrency,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${safeCurrency}`;
  }
}

/**
 * Intake list — cursor-paginated, filter-chip driven. 25 rows per page,
 * "Load more" button beneath the last row.
 */
export function IntakeList({ initialStatus }: IntakeListProps) {
  const t = useTranslations('EInvoice.intake');
  const tColumn = useTranslations('EInvoice.intake.column');
  const format = useFormatter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);

  const currentFilter = parseFilterParam(initialStatus ?? null);
  const statusFilter = currentFilter === 'all' ? undefined : currentFilter;

  const statusEnum = useMemo(() => {
    if (!statusFilter) return;
    const map: Record<string, IntakeStatus> = {
      needsReview: 'NEEDS_REVIEW',
      matched: 'MATCHED',
      converted: 'CONVERTED',
      rejected: 'REJECTED',
    };
    return map[statusFilter];
  }, [statusFilter]);

  const lastCursor = cursors[cursors.length - 1];
  const listQuery = useQuery(
    trpc.invoiceIntake.listByOrg.queryOptions({
      status: statusEnum,
      cursor: lastCursor,
      limit: 25,
    }),
  );

  const handleLoadMore = useCallback(() => {
    const data = listQuery.data as { nextCursor?: string } | undefined;
    if (data?.nextCursor) {
      setCursors(prev => [...prev, data.nextCursor]);
    }
  }, [listQuery.data]);

  const rows = (listQuery.data as { items?: IntakeRow[] } | undefined)?.items ?? [];
  const nextCursor = (listQuery.data as { nextCursor?: string } | undefined)?.nextCursor;

  const columns: ColumnDef<IntakeRow>[] = useMemo(
    () => [
      {
        id: 'supplier',
        header: () => tColumn('supplier'),
        cell: ({ row }) => (
          <Link
            href={`/invoices/intake/${row.original.id}`}
            className="block w-full truncate font-medium hover:underline">
            {row.original.extractedSupplierName ?? '—'}
          </Link>
        ),
      },
      {
        id: 'invoiceNumber',
        header: () => tColumn('invoiceNumber'),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.extractedInvoiceNumber ?? '—'}</span>
        ),
      },
      {
        id: 'date',
        header: () => tColumn('date'),
        cell: ({ row }) =>
          row.original.extractedInvoiceDate
            ? format.dateTime(new Date(row.original.extractedInvoiceDate), 'short')
            : '—',
      },
      {
        id: 'total',
        header: () => <span className="block text-right">{tColumn('total')}</span>,
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">
            {formatTotalMinor(row.original.extractedTotalMinor, row.original.extractedCurrency) ??
              '—'}
          </span>
        ),
      },
      {
        id: 'level',
        header: () => tColumn('level'),
        cell: ({ row }) =>
          row.original.extractedProfileLevel ? (
            <IntakeProfileLevelBadge level={row.original.extractedProfileLevel} />
          ) : (
            '—'
          ),
      },
      {
        id: 'status',
        header: () => tColumn('status'),
        cell: ({ row }) => <IntakeStatusPill status={row.original.status} />,
      },
      {
        id: 'validation',
        header: () => tColumn('validation'),
        cell: ({ row }) =>
          row.original.validationStatus ? (
            <IntakeValidationStatusPill status={row.original.validationStatus} />
          ) : (
            '—'
          ),
      },
    ],
    [tColumn, format],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: row => row.id,
  });

  const loadMoreFooter = nextCursor ? (
    <div className="flex w-full justify-center border-t p-4">
      <Button type="button" variant="ghost" onClick={handleLoadMore}>
        {t('loadMore')}
      </Button>
    </div>
  ) : null;

  return (
    <div className="space-y-6" data-slot="intake-list">
      <IntakeFilterChips />

      <AtelierTableShell
        isLoading={listQuery.isFetching && !listQuery.isLoading}
        footer={loadMoreFooter}>
        <Table>
          <caption className="sr-only">{t('pageSubtitle')}</caption>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id}>
                {hg.headers.map(h => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <DataTableBody
            table={table}
            isLoading={listQuery.isLoading}
            hasFiltersOrSearch={!!statusFilter}
            emptyIcon={<Inbox className="h-5 w-5" />}
            emptyTitle={t('emptyStateHeading')}
            emptyDescription={t('emptyStateBody')}
            emptyCta={t('splitButtonImport')}
            onEmptyCta={() => setUploadOpen(true)}
            emptyCtaIcon={Upload}
            noResultsTitle={t('emptyStateHeading')}
            noResultsDescription={t('emptyStateBody')}
            skeletonRows={8}
            skeletonColumns={{
              supplier: { shape: 'text', width: 'w-40' },
              invoiceNumber: { shape: 'text', width: 'w-28' },
              date: { shape: 'text', width: 'w-24' },
              total: { shape: 'text', width: 'w-20' },
              level: { shape: 'badge' },
              status: { shape: 'badge' },
              validation: { shape: 'badge' },
            }}
          />
        </Table>
      </AtelierTableShell>

      <IntakeUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}

import { AtelierTableShell, TableChrome } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import type { ColumnDef } from '@tanstack/react-table';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { RefreshCw } from 'lucide-react';
import { useMemo } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { DataTableBody } from '../shared/data-table-body.js';
import { SortableTableHead } from '../shared/sortable-table-head.js';

interface ReportTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onSortChange: (sortBy: string, sortOrder: string) => void;
  sortBy: string;
  sortOrder: string;
  onRowClick?: (row: TData) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  grandTotalLabel?: string;
  grandTotalValue?: string;
  /** Pre-pluralized entity label rendered in the chrome (e.g. "rows", "transactions"). */
  entityLabel?: string;
}

export function ReportTable<TData>({
  columns,
  data,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onSortChange,
  sortBy,
  sortOrder,
  onRowClick,
  isLoading,
  isFetching,
  isError,
  onRetry,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  grandTotalLabel,
  grandTotalValue,
  entityLabel,
}: ReportTableProps<TData>) {
  const tAria = useTranslations('Common.aria');
  const tCommon = useTranslations('Common');
  const tErr = useTranslations('Contractors.error');
  const pageCount = Math.ceil(totalCount / pageSize);

  const sorting = useMemo(() => [{ id: sortBy, desc: sortOrder === 'desc' }], [sortBy, sortOrder]);

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { sorting },
    onSortingChange: updater => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const first = next[0];
      if (first) {
        onSortChange(first.id, first.desc ? 'desc' : 'asc');
      }
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  const pagination =
    !isLoading && totalCount > 0 ? (
      <>
        <span className="text-sm text-muted-foreground">
          {tCommon('pagination.page', { page, pageCount, total: totalCount })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}>
            {tCommon('pagination.previous')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}>
            {tCommon('pagination.next')}
          </Button>
        </div>
      </>
    ) : undefined;

  return (
    <AtelierTableShell
      isLoading={isFetching && !isLoading}
      chrome={
        <TableChrome
          totalCount={totalCount}
          entityLabel={entityLabel ?? tCommon('rows', { count: totalCount })}
          densityLabels={{
            comfortable: tAria('densityComfortable'),
            compact: tAria('densityCompact'),
          }}
        />
      }
      footer={pagination}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <SortableTableHead
                  key={header.id}
                  header={header}
                  sortAriaLabel={tAria('sortBy', {
                    column:
                      typeof header.column.columnDef.header === 'string'
                        ? header.column.columnDef.header
                        : header.id,
                  })}
                />
              ))}
            </TableRow>
          ))}
        </TableHeader>
        {isError ? (
          <TableBody>
            <TableRow>
              <TableCell colSpan={columns.length} className="py-16 text-center">
                <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
                {onRetry ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-1.5"
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                    onClick={onRetry}>
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    {tErr('retry')}
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          </TableBody>
        ) : (
          <>
            <DataTableBody
              table={table}
              isLoading={isLoading ?? false}
              hasFiltersOrSearch={false}
              onRowClick={onRowClick}
              emptyIcon={emptyIcon}
              emptyTitle={emptyTitle ?? tCommon('noData')}
              emptyDescription={emptyDescription}
              noResultsTitle={emptyTitle ?? tCommon('noData')}
              noResultsDescription={emptyDescription}
            />
            {!isLoading && data.length > 0 && grandTotalLabel && grandTotalValue ? (
              <TableBody>
                <TableRow className="border-t-2">
                  <TableCell colSpan={columns.length - 1} className="text-[14px] font-semibold">
                    {grandTotalLabel}
                  </TableCell>
                  <TableCell className="text-[14px] font-semibold">{grandTotalValue}</TableCell>
                </TableRow>
              </TableBody>
            ) : null}
          </>
        )}
      </Table>
    </AtelierTableShell>
  );
}

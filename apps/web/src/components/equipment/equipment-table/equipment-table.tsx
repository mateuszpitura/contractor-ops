'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Package } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { trpc } from '@/trpc/init';
import type { EquipmentRow } from './equipment-columns';
import { getEquipmentColumns } from './equipment-columns';
import { EquipmentToolbar } from './equipment-toolbar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EquipmentTableProps {
  onEdit: (equipment: EquipmentRow) => void;
  onAssign: (equipment: EquipmentRow) => void;
  onUnassign: (equipment: EquipmentRow) => void;
  onCreateShipment: (equipment: EquipmentRow) => void;
  onRetire: (equipment: EquipmentRow) => void;
  onAddEquipment: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Equipment data table with server-side pagination, sorting, and filtering.
 */
export function EquipmentTable({
  onEdit,
  onAssign,
  onUnassign,
  onCreateShipment,
  onRetire,
  onAddEquipment,
}: EquipmentTableProps) {
  const t = useTranslations('Equipment');
  const tCommon = useTranslations('Common');

  // Filter/sort state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const pageSize = 25;

  // Build query input
  const queryInput = useMemo(
    () => ({
      page,
      pageSize,
      search: search || undefined,
      type: typeFilter.length
        ? (typeFilter as Array<
            'LAPTOP' | 'MONITOR' | 'PHONE' | 'HEADSET' | 'KEYBOARD' | 'MOUSE' | 'OTHER'
          >)
        : undefined,
      status: statusFilter.length
        ? (statusFilter as Array<
            | 'AVAILABLE'
            | 'ASSIGNED'
            | 'IN_TRANSIT'
            | 'DELIVERED'
            | 'RETURN_REQUESTED'
            | 'RETURN_IN_TRANSIT'
            | 'RETURNED'
            | 'RETIRED'
          >)
        : undefined,
      sortBy: sortBy as 'name' | 'type' | 'status' | 'createdAt',
      sortOrder,
    }),
    [page, search, typeFilter, statusFilter, sortBy, sortOrder],
  );

  // Fetch data
  const equipmentQuery = useQuery({
    ...trpc.equipment.list.queryOptions(queryInput),
    placeholderData: keepPreviousData,
  });

  const data = useMemo(() => {
    const result = equipmentQuery.data as { items: EquipmentRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [equipmentQuery.data]);

  const totalRows = useMemo(() => {
    const result = equipmentQuery.data as { items: unknown[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [equipmentQuery.data]);

  // Column definitions
  const columns = useMemo(
    () =>
      getEquipmentColumns(
        (key: string) => t(key as Parameters<typeof t>[0]),
        (key: string) => tCommon(key as Parameters<typeof tCommon>[0]),
        { onEdit, onAssign, onUnassign, onCreateShipment, onRetire },
      ),
    [t, tCommon, onEdit, onAssign, onUnassign, onCreateShipment, onRetire],
  );

  // TanStack Table instance
  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(totalRows / pageSize),
    state: {
      sorting: [{ id: sortBy, desc: sortOrder === 'desc' }],
    },
    onSortingChange: updater => {
      const next =
        typeof updater === 'function'
          ? updater([{ id: sortBy, desc: sortOrder === 'desc' }])
          : updater;
      const first = next[0];
      if (first) {
        setSortBy(first.id);
        setSortOrder(first.desc ? 'desc' : 'asc');
        setPage(1);
      } else {
        setSortBy('createdAt');
        setSortOrder('desc');
        setPage(1);
      }
    },
    enableSortingRemoval: true,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    getRowId: row => row.id,
  });

  // Filter handlers
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleFiltersChange = useCallback(
    (partial: Partial<{ type: string[]; status: string[] }>) => {
      if (partial.type !== undefined) setTypeFilter(partial.type);
      if (partial.status !== undefined) setStatusFilter(partial.status);
      setPage(1);
    },
    [],
  );

  const clearFilters = useCallback(() => {
    setSearch('');
    setTypeFilter([]);
    setStatusFilter([]);
    setPage(1);
  }, []);

  const isLoading = equipmentQuery.isPending && !equipmentQuery.data;
  const isRefetching = equipmentQuery.isFetching && !isLoading;
  const hasFiltersOrSearch = search.length > 0 || typeFilter.length > 0 || statusFilter.length > 0;

  const totalPages = Math.ceil(totalRows / pageSize);

  return (
    <div className="space-y-4">
      <EquipmentToolbar
        search={search}
        onSearchChange={handleSearchChange}
        filters={{ type: typeFilter, status: statusFilter }}
        onFiltersChange={handleFiltersChange}
        isSearching={isRefetching}
        onAddEquipment={onAddEquipment}
      />

      <div className="relative rounded-xl border bg-background">
        {!!isRefetching && (
          <div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-background/60 pt-20">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      header.column.getIsSorted() === 'asc'
                        ? 'ascending'
                        : header.column.getIsSorted() === 'desc'
                          ? 'descending'
                          : undefined
                    }
                    style={
                      header.column.getSize() === 150
                        ? undefined
                        : { width: header.column.getSize() }
                    }>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 uppercase hover:text-foreground"
                        onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <TableRow key={`skeleton-${i}`}>
                  {table.getVisibleLeafColumns().map(col => (
                    <TableCell key={col.id}>
                      <Skeleton className="h-4 w-full max-w-[120px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : hasFiltersOrSearch ? (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="py-16 text-center">
                  <h3 className="text-[16px] font-medium">No results found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try adjusting your search or filters.
                  </p>
                  <Button variant="outline" className="mt-4" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="py-16 text-center">
                  <Package className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <h3 className="mt-3 text-[16px] font-medium">{t('list.emptyTitle')}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t('list.emptyDescription')}</p>
                  <Button className="mt-4" onClick={onAddEquipment}>
                    {t('addEquipment')}
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {!isLoading && totalRows > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {totalRows} item{totalRows === 1 ? '' : 's'}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => setPage(p => Math.max(1, p - 1))}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { EquipmentIllustration } from '@contractor-ops/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { DataTableBody } from '@/components/shared/data-table-body';
import { SortableTableHead } from '@/components/shared/sortable-table-head';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow } from '@/components/ui/table';
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
  /**
   * When true, DataTableBody keeps showing skeleton rows even if the
   * table's own data has already arrived. Used by the page while its
   * count query is still in flight to prevent an in-table empty flash
   * before swapping to AtelierEmptyState.
   */
  parentLoading?: boolean;
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
  parentLoading,
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
      sortBy: sortBy as 'name' | 'serialNumber' | 'type' | 'status' | 'createdAt',
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
        t,
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
        disabled={isLoading || parentLoading === true}
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
                  <SortableTableHead key={header.id} header={header} />
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <DataTableBody
            table={table}
            isLoading={isLoading}
            forceLoading={parentLoading}
            hasFiltersOrSearch={hasFiltersOrSearch}
            emptyIcon={<EquipmentIllustration className="mx-auto h-16 w-16 text-primary/60" />}
            emptyTitle={t('list.emptyTitle')}
            emptyDescription={t('list.emptyDescription')}
            emptyCta={t('addEquipment')}
            onEmptyCta={onAddEquipment}
            emptyCtaIcon={Plus}
            noResultsTitle={t('noResults.heading')}
            noResultsDescription={t('noResults.body')}
            noResultsCta={t('noResults.cta')}
            onClearFilters={clearFilters}
          />
        </Table>

        {/* Pagination */}
        {!isLoading && totalRows > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {t('list.pagination.itemCount', { count: totalRows })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => setPage(p => Math.max(1, p - 1))}>
                {t('list.pagination.previous')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('list.pagination.pageOf', { page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => setPage(p => p + 1)}>
                {t('list.pagination.next')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

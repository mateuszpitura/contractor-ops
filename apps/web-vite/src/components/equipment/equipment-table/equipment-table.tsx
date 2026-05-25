import {
  AtelierTableShell,
  EquipmentIllustration,
  TableChrome,
  WORKBENCH_DATA_TABLE_CLASS,
} from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Table, TableHeader, TableRow } from '@contractor-ops/ui/components/shadcn/table';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { DataTableBody } from '../../shared/data-table-body.js';
import { SortableTableHead } from '../../shared/sortable-table-head.js';
import type { useEquipmentTable } from '../hooks/use-equipment-table.js';
import type { EquipmentRow } from './equipment-columns.js';
import { getEquipmentColumns } from './equipment-columns.js';
import { EquipmentToolbar } from './equipment-toolbar.js';

type EquipmentTableViewProps = {
  onEdit: (equipment: EquipmentRow) => void;
  onAssign: (equipment: EquipmentRow) => void;
  onUnassign: (equipment: EquipmentRow) => void;
  onCreateShipment: (equipment: EquipmentRow) => void;
  onRetire: (equipment: EquipmentRow) => void;
  onAddEquipment: () => void;
} & ReturnType<typeof useEquipmentTable>;

/**
 * Equipment data table with server-side pagination, sorting, and filtering.
 */
export function EquipmentTableView({
  onEdit,
  onAssign,
  onUnassign,
  onCreateShipment,
  onRetire,
  onAddEquipment,
  parentLoading,
  data,
  totalRows,
  search,
  typeFilter,
  statusFilter,
  page,
  sortBy,
  sortOrder,
  onSearchChange,
  onFiltersChange,
  onPageChange,
  onSortChange,
  onClearFilters,
  isLoading,
  isRefetching,
  activeFilterCount,
  hasFiltersOrSearch,
  totalPages,
}: EquipmentTableViewProps) {
  const t = useTranslations('Equipment');
  const tCommon = useTranslations('Common');
  const tAria = useTranslations('Common.aria');

  const columns = useMemo(
    () =>
      getEquipmentColumns(t, tCommon, {
        onEdit,
        onAssign,
        onUnassign,
        onCreateShipment,
        onRetire,
      }),
    [t, tCommon, onEdit, onAssign, onUnassign, onCreateShipment, onRetire],
  );

  const table = useReactTable({
    data,
    columns,
    pageCount: totalPages,
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
        onSortChange(first.id, first.desc ? 'desc' : 'asc');
      } else {
        onSortChange('createdAt', 'desc');
      }
    },
    enableSortingRemoval: true,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    getRowId: row => row.id,
  });

  return (
    <div className={WORKBENCH_DATA_TABLE_CLASS}>
      <EquipmentToolbar
        search={search}
        onSearchChange={onSearchChange}
        filters={{ type: typeFilter, status: statusFilter }}
        onFiltersChange={onFiltersChange}
        isSearching={isRefetching}
        disabled={isLoading || parentLoading === true}
        onAddEquipment={onAddEquipment}
      />

      <AtelierTableShell
        isLoading={isLoading || isRefetching || parentLoading === true}
        chrome={
          <TableChrome
            totalCount={totalRows}
            entityLabel={t('entityLabel', { count: totalRows })}
            hasActiveFilters={hasFiltersOrSearch}
            clearFiltersLabel={t('clearFiltersChip', { count: activeFilterCount })}
            onClearFilters={onClearFilters}
            densityLabels={{
              comfortable: tAria('densityComfortable'),
              compact: tAria('densityCompact'),
            }}
          />
        }
        footer={
          !isLoading && totalRows > 0 ? (
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {t('list.pagination.itemCount', { count: totalRows })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => onPageChange(Math.max(1, page - 1))}>
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
                  onClick={() => onPageChange(page + 1)}>
                  {t('list.pagination.next')}
                </Button>
              </div>
            </div>
          ) : undefined
        }>
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
            onClearFilters={onClearFilters}
          />
        </Table>
      </AtelierTableShell>
    </div>
  );
}

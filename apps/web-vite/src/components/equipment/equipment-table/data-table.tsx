import { EquipmentIllustration } from '@contractor-ops/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { WorkbenchDataTable } from '../../table-kit/workbench-data-table.js';
import { useEquipmentBulkActions } from '../hooks/use-equipment-bulk-actions.js';
import { useEquipmentTable } from '../hooks/use-equipment-table.js';
import { DataTableBulkActions } from './data-table-bulk-actions.js';
import type { EquipmentRow } from './equipment-columns.js';
import { getEquipmentColumns } from './equipment-columns.js';
import { EquipmentToolbar } from './equipment-toolbar.js';

function getRowId(row: EquipmentRow): string {
  return row.id;
}

type EquipmentTableViewProps = {
  onEdit: (equipment: EquipmentRow) => void;
  onAssign: (equipment: EquipmentRow) => void;
  onUnassign: (equipment: EquipmentRow) => void;
  onCreateShipment: (equipment: EquipmentRow) => void;
  onRetire: (equipment: EquipmentRow) => void;
  onAddEquipment: () => void;
  bulkActions: ReturnType<typeof useEquipmentBulkActions>;
  sectionClassName?: string;
} & ReturnType<typeof useEquipmentTable>;

/**
 * Equipment data table — host for the canonical `DataTable` primitive. The
 * `useEquipmentTable` hook owns query + filter/sort/search state and the
 * controlled row-selection map; this view wires them into the primitive
 * alongside the equipment toolbar and bulk-action bar.
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
  pageSize,
  onSearchChange,
  onFiltersChange,
  onPageChange,
  onPageSizeChange,
  sorting,
  handleSortingChange,
  onClearFilters,
  isLoading,
  isRefetching,
  activeFilterCount,
  hasFiltersOrSearch,
  rowSelection,
  setRowSelection,
  bulkActions,
  sectionClassName,
}: EquipmentTableViewProps) {
  const t = useTranslations('Equipment');
  const tCommon = useTranslations('Common');

  const columns: ColumnDef<EquipmentRow, unknown>[] = useMemo(
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

  const handlePageChange = useCallback(
    (pageIndex: number) => onPageChange(pageIndex + 1),
    [onPageChange],
  );

  const clearRowSelection = useCallback(() => setRowSelection({}), [setRowSelection]);

  const selectedRows = useMemo(() => {
    const ids = new Set(Object.keys(rowSelection).filter(id => rowSelection[id]));
    return data.filter(row => ids.has(row.id));
  }, [rowSelection, data]);

  return (
    <WorkbenchDataTable
      sectionClassName={sectionClassName}
      columns={columns}
      data={data}
      totalRows={totalRows}
      pageIndex={Math.max(0, page - 1)}
      pageSize={pageSize}
      onPageChange={handlePageChange}
      onPageSizeChange={onPageSizeChange}
      sorting={sorting}
      onSortingChange={handleSortingChange}
      isLoading={isLoading}
      isRefetching={isRefetching}
      forceLoading={parentLoading}
      fill
      entityLabel={t('entityLabel', { count: totalRows })}
      hasFiltersOrSearch={hasFiltersOrSearch}
      onClearFilters={onClearFilters}
      clearFiltersLabel={t('clearFiltersChip', { count: activeFilterCount })}
      toolbar={
        <EquipmentToolbar
          search={search}
          onSearchChange={onSearchChange}
          filters={{ type: typeFilter, status: statusFilter }}
          onFiltersChange={onFiltersChange}
          isSearching={isRefetching}
          disabled={isLoading || parentLoading === true}
          onAddEquipment={onAddEquipment}
        />
      }
      bulkBar={
        selectedRows.length > 0 ? (
          <DataTableBulkActions
            selectedRows={selectedRows}
            bulkActions={bulkActions}
            onComplete={clearRowSelection}
          />
        ) : undefined
      }
      enableRowSelection
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      getRowId={getRowId}
      emptyIllustration={EquipmentIllustration}
      emptyTitle={t('list.emptyTitle')}
      emptyDescription={t('list.emptyDescription')}
      emptyCta={t('addEquipment')}
      onEmptyCta={onAddEquipment}
      emptyCtaIcon={Plus}
      noResultsTitle={t('noResults.heading')}
      noResultsDescription={t('noResults.body')}
      noResultsCta={t('noResults.cta')}
    />
  );
}

interface EquipmentDataTableProps {
  onEdit: (equipment: EquipmentRow) => void;
  onAssign: (equipment: EquipmentRow) => void;
  onUnassign: (equipment: EquipmentRow) => void;
  onCreateShipment: (equipment: EquipmentRow) => void;
  onRetire: (equipment: EquipmentRow) => void;
  onAddEquipment: () => void;
  parentLoading?: boolean;
  sectionClassName?: string;
}

export function EquipmentDataTable(props: EquipmentDataTableProps) {
  const tableState = useEquipmentTable(props.parentLoading);
  const bulkActions = useEquipmentBulkActions();
  return (
    <EquipmentTableView
      {...props}
      {...tableState}
      bulkActions={bulkActions}
      sectionClassName={props.sectionClassName}
    />
  );
}

/**
 * Invoice selection data table — host for the canonical `DataTable` primitive.
 *
 * Used inside the new payment-run wizard. Parent owns the selection state
 * (the controlled `rowSelection` map is derived from `selectedInvoiceIds`),
 * and rows already attached to another run are non-selectable via the
 * canonical primitive's `isRowSelectable` predicate.
 */

import type { ColumnDef, Row, RowSelectionState } from '@tanstack/react-table';
import { useCallback, useState } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { WorkbenchDataTable } from '../../table-kit/workbench-data-table.js';
import type { ReadyInvoiceRow } from './columns.js';

interface InvoiceSelectionDataTableProps {
  data: ReadyInvoiceRow[];
  columns: ColumnDef<ReadyInvoiceRow>[];
  isLoading: boolean;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (selection: RowSelectionState) => void;
}

export function InvoiceSelectionDataTable({
  data,
  columns,
  isLoading,
  rowSelection,
  onRowSelectionChange,
}: InvoiceSelectionDataTableProps) {
  const t = useTranslations('Payments');
  const tInvoices = useTranslations('Invoices');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const handleRowSelectionChange = useCallback(
    (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      onRowSelectionChange(next);
    },
    [rowSelection, onRowSelectionChange],
  );

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);

  const rowClassName = useCallback(
    (row: ReadyInvoiceRow) => (row._inRunNumber ? 'bg-yellow-500/5' : ''),
    [],
  );

  const isRowSelectable = useCallback(
    (row: Row<ReadyInvoiceRow>) => !row.original._inRunNumber,
    [],
  );

  const getRowId = useCallback((row: ReadyInvoiceRow) => row.id, []);

  return (
    <WorkbenchDataTable
      columns={columns}
      data={data}
      totalRows={data.length}
      clientPagination
      pageIndex={pageIndex}
      pageSize={pageSize}
      onPageChange={setPageIndex}
      onPageSizeChange={handlePageSizeChange}
      isLoading={isLoading}
      hideDensityToggle
      constrainHeight={false}
      entityLabel={tInvoices('entityLabel', { count: data.length })}
      emptyTitle={t('step1.noInvoicesHeading')}
      emptyDescription={t('step1.noInvoicesBody')}
      noResultsTitle={t('step1.noInvoicesHeading')}
      noResultsDescription={t('step1.noInvoicesBody')}
      enableRowSelection
      rowSelection={rowSelection}
      onRowSelectionChange={handleRowSelectionChange}
      isRowSelectable={isRowSelectable}
      getRowId={getRowId}
      rowClassName={rowClassName}
      skeletonRows={6}
    />
  );
}

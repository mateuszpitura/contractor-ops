import type { ColumnDef } from '@tanstack/react-table';
import { useCallback } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { WorkbenchDataTable } from '../../table-kit/workbench-data-table.js';
import type { ApprovalQueueRow } from './columns.js';

interface ApprovalQueueTableProps {
  data: ApprovalQueueRow[];
  columns: ColumnDef<ApprovalQueueRow>[];
  pageCount: number;
  page: number;
  pageSize: number;
  totalCount?: number;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  activeFilterCount?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRowClick: (row: ApprovalQueueRow) => void;
  onSelectionChange?: (ids: string[]) => void;
  isLoading?: boolean;
  sectionClassName?: string;
}

function isOverdue(row: ApprovalQueueRow): boolean {
  if (row.status !== 'PENDING' || !row.slaDeadline) return false;
  return new Date(row.slaDeadline).getTime() < Date.now();
}

function rowClassNameForOverdue(row: ApprovalQueueRow): string {
  return `group ${isOverdue(row) ? 'bg-destructive/5' : ''}`;
}

function getRowId(row: ApprovalQueueRow): string {
  return row.id;
}

export function ApprovalQueueTable({
  data,
  columns,
  pageCount: _pageCount,
  page,
  pageSize,
  totalCount,
  hasActiveFilters,
  onClearFilters,
  activeFilterCount = 0,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  onSelectionChange,
  isLoading,
  sectionClassName,
}: ApprovalQueueTableProps) {
  const t = useTranslations('Approvals');

  const resolvedTotal = totalCount ?? data.length;

  const handleSelectionChange = useCallback(
    (rows: ApprovalQueueRow[]) => {
      onSelectionChange?.(rows.map(row => row.id));
    },
    [onSelectionChange],
  );

  const handlePageChange = useCallback((next: number) => onPageChange(next + 1), [onPageChange]);

  return (
    <WorkbenchDataTable
      sectionClassName={sectionClassName}
      columns={columns}
      data={data}
      totalRows={resolvedTotal}
      pageIndex={Math.max(0, page - 1)}
      pageSize={pageSize}
      onPageChange={handlePageChange}
      onPageSizeChange={onPageSizeChange}
      isLoading={isLoading}
      fill
      entityLabel={t('entityLabel', { count: resolvedTotal })}
      hasFiltersOrSearch={Boolean(hasActiveFilters)}
      onClearFilters={onClearFilters}
      clearFiltersLabel={t('clearFiltersChip', { count: activeFilterCount })}
      onRowClick={onRowClick}
      rowClassName={rowClassNameForOverdue}
      enableRowSelection
      onSelectionChange={handleSelectionChange}
      getRowId={getRowId}
      emptyTitle={t('empty.heading')}
      emptyDescription={t('empty.body')}
      noResultsTitle={t('noResults.heading')}
      noResultsDescription={t('noResults.body')}
      noResultsCta={t('noResults.cta')}
    />
  );
}

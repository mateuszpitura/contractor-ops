import { DataTable, WorkflowsIllustration } from '@contractor-ops/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Play } from 'lucide-react';
import { useMemo } from 'react';

import { formatDate } from '../../../lib/format-date.js';
import type { useWorkflowRunsDataTable } from '../hooks/use-workflow-runs-data-table.js';
import type { WorkflowRunRow } from './columns.js';
import { getColumns } from './columns.js';
import { DataTableFilters } from './data-table-filters.js';
import { DataTableToolbar } from './data-table-toolbar.js';

interface WorkflowRunsDataTableProps extends ReturnType<typeof useWorkflowRunsDataTable> {
  onRowClick: (run: WorkflowRunRow) => void;
  onStartWorkflow: () => void;
  parentLoading?: boolean;
}

/**
 * Presentational wrapper for the workflow runs list. Delegates table state +
 * loading lockout to the canonical `DataTable` primitive.
 */
export function WorkflowRunsDataTable({
  t,
  filters,
  data,
  totalRows,
  sorting,
  onSortingChange,
  isLoading,
  isRefetching,
  activeFilterCount,
  hasFiltersOrSearch,
  handleFiltersChange,
  handleSearchChange,
  handlePageChange,
  handlePageSizeChange,
  clearFilters,
  rowClassName,
  templates,
  onRowClick,
  onStartWorkflow,
  parentLoading,
}: WorkflowRunsDataTableProps) {
  const columns = useMemo<ColumnDef<WorkflowRunRow>[]>(() => getColumns(t, formatDate), [t]);

  const toolbar = (
    <DataTableFilters
      filters={{
        status: filters.status,
        templateId: filters.templateId,
        overdueOnly: filters.overdueOnly,
      }}
      onFiltersChange={handleFiltersChange}
      disabled={isLoading || parentLoading === true}
      templates={templates}>
      {(filterTrigger, filterBadges) => (
        <DataTableToolbar
          search={filters.search}
          onSearchChange={handleSearchChange}
          isSearching={isRefetching}
          disabled={isLoading || parentLoading === true}
          onStartWorkflow={onStartWorkflow}
          filterTrigger={filterTrigger}
          filterBadges={filterBadges}
        />
      )}
    </DataTableFilters>
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      totalRows={totalRows}
      pageIndex={Math.max(0, filters.page - 1)}
      pageSize={filters.pageSize}
      onPageChange={handlePageChange}
      onPageSizeChange={handlePageSizeChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      isLoading={isLoading}
      isRefetching={isRefetching}
      forceLoading={parentLoading}
      fill
      entityLabel={t('entityLabel', { count: totalRows })}
      hasFiltersOrSearch={hasFiltersOrSearch}
      onClearFilters={clearFilters}
      clearFiltersLabel={t('clearFiltersChip', { count: activeFilterCount })}
      toolbar={toolbar}
      onRowClick={onRowClick}
      rowClassName={rowClassName}
      getRowId={row => row.id}
      emptyIcon={<WorkflowsIllustration className="mx-auto h-16 w-16 text-primary/60" />}
      emptyTitle={t('empty.heading')}
      emptyDescription={t('empty.body')}
      emptyCta={t('empty.cta')}
      onEmptyCta={onStartWorkflow}
      emptyCtaIcon={Play}
      noResultsTitle={t('noResults.heading')}
      noResultsDescription={t('noResults.body')}
      noResultsCta={t('noResults.cta')}
      skeletonColumns={{
        select: { shape: 'checkbox' },
        workflowName: { shape: 'text', width: 'w-40' },
        contractor: { shape: 'text', width: 'w-36' },
        templateType: { shape: 'badge' },
        status: { shape: 'badge' },
        progress: { shape: 'text', width: 'w-20' },
        startedAt: { shape: 'text', width: 'w-24' },
        dueAt: { shape: 'text', width: 'w-24' },
      }}
    />
  );
}

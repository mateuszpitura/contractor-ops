import {
  AtelierTableShell,
  TableChrome,
  WORKBENCH_DATA_TABLE_CLASS,
  WorkflowsIllustration,
} from '@contractor-ops/ui';
import { Table, TableHeader, TableRow } from '@contractor-ops/ui/components/shadcn/table';
import { Play } from 'lucide-react';

import { DataTableBody } from '../../shared/data-table-body.js';
import { SortableTableHead } from '../../shared/sortable-table-head.js';
import type { useWorkflowRunsDataTable } from '../hooks/use-workflow-runs-data-table.js';
import type { WorkflowRunRow } from './columns.js';
import { DataTableFilters } from './data-table-filters.js';
import { DataTablePagination } from './data-table-pagination.js';
import { DataTableToolbar } from './data-table-toolbar.js';

interface WorkflowRunsDataTableProps extends ReturnType<typeof useWorkflowRunsDataTable> {
  onRowClick: (run: WorkflowRunRow) => void;
  onStartWorkflow: () => void;
  parentLoading?: boolean;
}

/**
 * Presentational TanStack Table wrapper for the workflow runs list.
 */
export function WorkflowRunsDataTable({
  t,
  tAria,
  filters,
  table,
  totalRows,
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
  const tableLoading = isLoading || isRefetching || parentLoading === true;

  return (
    <div className={WORKBENCH_DATA_TABLE_CLASS}>
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

      <AtelierTableShell
        isLoading={tableLoading}
        chrome={
          <TableChrome
            totalCount={totalRows}
            entityLabel={t('entityLabel', { count: totalRows })}
            hasActiveFilters={hasFiltersOrSearch}
            clearFiltersLabel={t('clearFiltersChip', { count: activeFilterCount })}
            onClearFilters={clearFilters}
            densityLabels={{
              comfortable: tAria('densityComfortable'),
              compact: tAria('densityCompact'),
            }}
          />
        }
        footer={
          !isLoading && totalRows > 0 ? (
            <DataTablePagination
              table={table}
              totalRows={totalRows}
              pageSize={filters.pageSize}
              currentPage={filters.page}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          ) : undefined
        }>
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
          <DataTableBody
            table={table}
            isLoading={isLoading}
            forceLoading={parentLoading}
            hasFiltersOrSearch={hasFiltersOrSearch}
            onRowClick={onRowClick}
            rowClassName={rowClassName}
            emptyIcon={<WorkflowsIllustration className="mx-auto h-16 w-16 text-primary/60" />}
            emptyTitle={t('empty.heading')}
            emptyDescription={t('empty.body')}
            emptyCta={t('empty.cta')}
            onEmptyCta={onStartWorkflow}
            emptyCtaIcon={Play}
            noResultsTitle={t('noResults.heading')}
            noResultsDescription={t('noResults.body')}
            noResultsCta={t('noResults.cta')}
            onClearFilters={clearFilters}
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
        </Table>
      </AtelierTableShell>
    </div>
  );
}

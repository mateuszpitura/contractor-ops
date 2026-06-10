import { AtelierEmptyState, SectionLabel, WorkflowsIllustration } from '@contractor-ops/ui';
import type { ColumnDef, Table } from '@tanstack/react-table';
import { GitBranch, Play, Plus } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { formatDate } from '../../../lib/format-date.js';
import { renderEmptyStateAction } from '../../shared/atelier-bridges.js';
import { WorkbenchDataTable } from '../../table-kit/workbench-data-table.js';
import type { useWorkflowRunsDataTable as UseWorkflowRunsDataTable } from '../hooks/use-workflow-runs-data-table.js';
import { useWorkflowRunsDataTable } from '../hooks/use-workflow-runs-data-table.js';
import type { WorkflowRunRow } from './columns.js';
import { getColumns } from './columns.js';
import { DataTableColumnToggle } from './data-table-column-toggle.js';
import { DataTableFilters } from './data-table-filters.js';
import { DataTableToolbar } from './data-table-toolbar.js';

interface WorkflowRunsDataTableProps extends ReturnType<typeof UseWorkflowRunsDataTable> {
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
  columnVisibility,
  setColumnVisibility,
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

  const renderColumnToggle = useCallback(
    (table: Table<WorkflowRunRow>) => <DataTableColumnToggle table={table} />,
    [],
  );

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
    <WorkbenchDataTable
      columns={columns}
      data={data}
      totalRows={totalRows}
      pageIndex={Math.max(0, filters.page - 1)}
      pageSize={filters.pageSize}
      onPageChange={handlePageChange}
      onPageSizeChange={handlePageSizeChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={setColumnVisibility}
      isLoading={isLoading}
      isRefetching={isRefetching}
      forceLoading={parentLoading}
      fill
      entityLabel={t('entityLabel', { count: totalRows })}
      hasFiltersOrSearch={hasFiltersOrSearch}
      onClearFilters={clearFilters}
      clearFiltersLabel={t('clearFiltersChip', { count: activeFilterCount })}
      toolbar={toolbar}
      rightSlot={renderColumnToggle}
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

interface WorkflowRunsDataTableSectionProps {
  onRowClick: (run: WorkflowRunRow) => void;
  onStartWorkflow: () => void;
  parentLoading?: boolean;
  contractorCount: number;
  canManageTemplates: boolean;
}

export function WorkflowRunsDataTableSection({
  onRowClick,
  onStartWorkflow,
  parentLoading,
  contractorCount,
  canManageTemplates,
}: WorkflowRunsDataTableSectionProps) {
  const te = useTranslations('EmptyStates');
  const table = useWorkflowRunsDataTable();

  const showRunsEmpty =
    !table.isLoading &&
    parentLoading !== true &&
    table.totalRows === 0 &&
    !table.hasFiltersOrSearch;

  if (showRunsEmpty) {
    return (
      <AtelierEmptyState
        variant="page"
        illustration={WorkflowsIllustration}
        heading={table.t('empty.heading')}
        body={table.t('empty.body')}
        primaryAction={{
          label: table.t('empty.cta'),
          onClick: onStartWorkflow,
          icon: Play,
        }}
        secondaryAction={
          canManageTemplates
            ? {
                label: table.t('templates.newTemplate'),
                href: '/workflows/templates/new',
                icon: Plus,
              }
            : undefined
        }
        prerequisiteMissing={contractorCount === 0}
        prerequisiteAction={{ label: te('prerequisite.cta'), href: '/contractors' }}
        renderAction={renderEmptyStateAction}
      />
    );
  }

  return (
    <>
      <SectionLabel icon={GitBranch}>{table.t('pageTitle')}</SectionLabel>
      <WorkflowRunsDataTable
        {...table}
        onRowClick={onRowClick}
        onStartWorkflow={onStartWorkflow}
        parentLoading={parentLoading}
      />
    </>
  );
}

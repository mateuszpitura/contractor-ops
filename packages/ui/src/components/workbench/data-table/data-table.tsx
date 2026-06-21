'use client';

import type { Table } from '@tanstack/react-table';
import { useCallback, useEffect } from 'react';

import { useUITranslations } from '../../../i18n/translations-provider.js';
import { Table as ShadcnTable, TableHeader, TableRow } from '../../shadcn/table.js';
import { AtelierEmptyState } from '../empty-state.js';
import { TableChrome } from '../table-chrome.js';
import {
  WORKBENCH_DATA_TABLE_CLASS,
  WORKBENCH_EMPTY_STATE_PAGE_CLASS,
} from '../table-page-layout.js';
import { AtelierTableShell } from '../table-shell.js';
import { DataTableBody } from './data-table-body.js';
import { DataTableBulkActions } from './data-table-bulk-actions.js';
import { DataTablePagination } from './data-table-pagination.js';
import { DataTableLoadingContext } from './loading-context.js';
import { SortableTableHead } from './sortable-table-head.js';
import type { DataTableProps } from './types.js';
import { DEFAULT_PAGE_SIZE_OPTIONS } from './types.js';
import { useDataTable } from './use-data-table.js';

/**
 * Canonical workbench data table. Composes `AtelierTableShell` + chrome +
 * sortable headers + body + pagination + bulk actions into one primitive.
 *
 * Modes:
 *  - **server (default)**: caller passes `pageIndex`, `pageSize`, `totalRows`,
 *    `onPageChange`, `onPageSizeChange`, `sorting`, `onSortingChange`. Data
 *    is assumed pre-paginated and pre-sorted by the server.
 *  - **client**: pass `clientPagination={true}`. The primitive installs
 *    `getPaginationRowModel` and slices `data` locally; `totalRows` defaults
 *    to `data.length` for footer auto-hide math.
 *
 * Two-tier empty: pass `emptyIllustration` to render the full
 * `AtelierEmptyState variant="page"` panel for zero-row first-class lists.
 * Sub-tables omit the prop and fall back to the compact in-table empty row.
 *
 * Loading lockout: the primitive disables its own bulk-action buttons,
 * pagination controls, and clear-filters chip while `isLoading || isRefetching`
 * is true. Caller-rendered toolbars can read `useDataTableLoading()` to
 * disable their own filter inputs.
 */
interface FeaturedEmptyPanelProps {
  loading: boolean;
  illustration: NonNullable<DataTableProps<unknown>['emptyIllustration']>;
  heading: string;
  body: string;
  cta: string | undefined;
  onCta: (() => void) | undefined;
  ctaIcon: DataTableProps<unknown>['emptyCtaIcon'];
}

// Full-bleed empty panel for zero-row first-class lists (shown only when an
// illustration is supplied and no filters/search are active).
function FeaturedEmptyPanel({
  loading,
  illustration,
  heading,
  body,
  cta,
  onCta,
  ctaIcon,
}: FeaturedEmptyPanelProps) {
  return (
    <DataTableLoadingContext.Provider value={loading}>
      <div className={WORKBENCH_EMPTY_STATE_PAGE_CLASS}>
        <AtelierEmptyState
          variant="page"
          illustration={illustration}
          heading={heading}
          body={body}
          primaryAction={onCta && cta ? { label: cta, onClick: onCta, icon: ctaIcon } : undefined}
          renderAction={defaultRenderAction}
        />
      </div>
    </DataTableLoadingContext.Provider>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: canonical table primitive — after lifting the featured-empty branch to FeaturedEmptyPanel, the residual is the single composition that wires toolbar/bulk/chrome/header/body/footer with their per-prop loading + clientPagination conditionals; threading those ~30 props into a sibling would scatter the contract without reducing it.
export function DataTable<TData>(props: DataTableProps<TData>) {
  const {
    columns,
    data,
    totalRows,
    entityLabel,
    emptyTitle,
    noResultsTitle,

    isLoading = false,
    isRefetching = false,
    forceLoading,
    skeletonRows,
    skeletonColumns,

    pageIndex,
    pageSize,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    onPageChange,
    onPageSizeChange,
    clientPagination = false,

    sorting,
    onSortingChange,

    columnVisibility,
    onColumnVisibilityChange,

    hasFiltersOrSearch = false,
    onClearFilters,
    clearFiltersLabel,
    toolbar,
    bulkBar,

    emptyDescription,
    emptyCta,
    onEmptyCta,
    emptyCtaIcon,
    emptyIcon,
    emptyIllustration: EmptyIllustration,

    noResultsDescription,
    noResultsCta,

    onRowClick,
    rowClassName,
    getRowId,

    renderSubRow,
    expandedRowIds,

    bulkActions,
    enableRowSelection: enableRowSelectionProp,
    onSelectionChange,
    rowSelection: controlledRowSelection,
    onRowSelectionChange,
    isRowSelectable,

    rightSlot,
    hideDensityToggle = false,
    hideChrome = false,
    hideFooter = false,
    constrainHeight = true,
    fill = false,
    className,
  } = props;

  const t = useUITranslations();
  const loading = isLoading || isRefetching;

  const enableSelection = enableRowSelectionProp ?? (bulkActions?.length ?? 0) > 0;

  const { table, clearSelection, selectedRows, shouldHideFooter } = useDataTable({
    data,
    columns,
    pageIndex,
    pageSize,
    totalRows,
    sorting,
    onSortingChange,
    clientPagination,
    pageSizeOptions,
    enableRowSelection: enableSelection,
    getRowId,
    columnVisibility,
    onColumnVisibilityChange,
    controlledRowSelection,
    onControlledRowSelectionChange: onRowSelectionChange,
    isRowSelectable,
  });

  useEffect(() => {
    if (onSelectionChange) onSelectionChange(selectedRows);
  }, [onSelectionChange, selectedRows]);

  const handlePageChange = useCallback(
    (page: number) => onPageChange(Math.max(0, page - 1)),
    [onPageChange],
  );

  const resolvedClearLabel = clearFiltersLabel ?? t('aria.clearFilters');
  const resolvedSkeletonRows = skeletonRows ?? (EmptyIllustration ? 8 : 6);

  // Two-tier empty: full panel for first-class lists.
  const showFeaturedEmpty =
    !!EmptyIllustration && !loading && !forceLoading && data.length === 0 && !hasFiltersOrSearch;

  if (showFeaturedEmpty && EmptyIllustration) {
    return (
      <FeaturedEmptyPanel
        loading={loading}
        illustration={EmptyIllustration}
        heading={emptyTitle}
        body={emptyDescription ?? ''}
        cta={emptyCta}
        onCta={onEmptyCta}
        ctaIcon={emptyCtaIcon}
      />
    );
  }

  const resolvedRightSlot =
    typeof rightSlot === 'function'
      ? (rightSlot as (t: Table<TData>) => unknown)(table)
      : rightSlot;

  const paginationFooter =
    hideFooter || shouldHideFooter ? null : (
      <DataTablePagination
        totalRows={clientPagination ? data.length : totalRows}
        pageSize={pageSize}
        currentPage={pageIndex + 1}
        onPageChange={handlePageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={pageSizeOptions}
        disabled={loading}
      />
    );

  const toolbarNode =
    typeof toolbar === 'function'
      ? (toolbar as (ctx: { disabled: boolean }) => unknown)({ disabled: loading })
      : toolbar;

  const wrapperClass = constrainHeight && fill ? WORKBENCH_DATA_TABLE_CLASS : 'flex flex-col gap-4';

  return (
    <DataTableLoadingContext.Provider value={loading}>
      <div className={`${wrapperClass}${className ? ` ${className}` : ''}`}>
        {toolbarNode ? <div className="shrink-0">{toolbarNode as React.ReactNode}</div> : null}
        {bulkBar ? <div className="shrink-0">{bulkBar}</div> : null}
        {bulkActions && bulkActions.length > 0 ? (
          <DataTableBulkActions
            selectedRows={selectedRows}
            actions={bulkActions}
            onClearSelection={clearSelection}
            disabled={loading}
          />
        ) : null}
        <AtelierTableShell
          constrainHeight={constrainHeight}
          fill={fill}
          isLoading={loading}
          footer={paginationFooter}
          chrome={
            hideChrome ? undefined : (
              <TableChrome
                totalCount={clientPagination ? data.length : totalRows}
                entityLabel={entityLabel}
                hasActiveFilters={hasFiltersOrSearch}
                clearFiltersLabel={resolvedClearLabel}
                onClearFilters={loading ? undefined : onClearFilters}
                rightSlot={resolvedRightSlot as React.ReactNode}
                hideDensityToggle={hideDensityToggle}
              />
            )
          }>
          <ShadcnTable>
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
              forceLoading={forceLoading}
              hasFiltersOrSearch={hasFiltersOrSearch}
              onRowClick={onRowClick}
              rowClassName={rowClassName}
              renderSubRow={renderSubRow}
              expandedRowIds={expandedRowIds}
              emptyIcon={emptyIcon}
              emptyTitle={emptyTitle}
              emptyDescription={emptyDescription}
              emptyCta={emptyCta}
              onEmptyCta={onEmptyCta}
              emptyCtaIcon={emptyCtaIcon}
              noResultsTitle={noResultsTitle}
              noResultsDescription={noResultsDescription}
              noResultsCta={noResultsCta}
              onClearFilters={loading ? undefined : onClearFilters}
              skeletonRows={resolvedSkeletonRows}
              skeletonColumns={skeletonColumns}
            />
          </ShadcnTable>
        </AtelierTableShell>
      </div>
    </DataTableLoadingContext.Provider>
  );
}

/**
 * Default render for the full-panel empty CTA when the caller does not pass
 * a `Link`-bridged renderer. Triggers `onClick`; ignores `href` since the
 * primitive can't import a locale-aware Link.
 */
function defaultRenderAction(
  action: {
    label: string;
    onClick?: () => void;
    icon?: React.ComponentType<{ className?: string }>;
  },
  _variant: 'primary' | 'secondary',
): React.ReactNode {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={action.onClick}
      className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {action.label}
    </button>
  );
}

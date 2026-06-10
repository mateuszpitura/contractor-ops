/**
 * Admin time tracking — route shell with inlined page content.
 */

import {
  AtelierEmptyState,
  DataTable,
  QueryErrorPanel,
  SectionLabel,
  TimeTrackingIllustration,
  WORKBENCH_TABLE_PAGE_FILL_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
  WORKBENCH_TABLE_TAB_PANEL_CLASS,
  WORKBENCH_TABLE_TABS_CLASS,
} from '@contractor-ops/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import type { ColumnDef } from '@tanstack/react-table';
import { addDays, format, startOfISOWeek } from 'date-fns';
import { Clock } from 'lucide-react';
import { Suspense, useCallback, useMemo } from 'react';

import { ApprovalQueueTable } from '../../components/time/approval-queue/data-table.js';
import type { TimesheetRow } from '../../components/time/approval-queue/data-table.js';
import { TIME_STATUS_FILTER_ALL, useTimeTracking } from '../../components/time/hooks/use-time-tracking.js';
import { ReconciliationSpotCheck } from '../../components/time/reconciliation-spot-check.js';
import { ReconciliationTable } from '../../components/time/reconciliation-table.js';
import { TimeEntryStatusBadge } from '../../components/time/time-entry-status-badge.js';
import { AnimateIn } from '../../components/shared/animate-in.js';
import { renderEmptyStateAction } from '../../components/shared/atelier-bridges.js';
import { isListControlsDisabled } from '../../components/shared/list-controls-disabled.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../components/shared/workbench-page-header.js';
import { useTranslations } from '../../i18n/useTranslations.js';

function formatPeriod(weekStart: string | Date): string {
  const start = typeof weekStart === 'string' ? new Date(weekStart) : weekStart;
  const monday = startOfISOWeek(start);
  const sunday = addDays(monday, 6);
  return `${format(monday, 'MMM d')} - ${format(sunday, 'MMM d')}`;
}

function minutesToDisplay(minutes: number): string {
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function TimePageContent() {
  const {
    t,
    tab,
    setTab,
    statusFilter,
    setStatusFilter,
    pendingQuery,
    allQuery,
    pendingTimesheets,
    allTimesheets,
    handleApprove,
    handleReject,
    handleBulkApprove,
    handleBulkReject,
    handleNavigateToReview,
    allPageSize,
    allCurrentPage,
    allTotalCount,
    handleAllPageChange,
    handleAllPageSizeChange,
    isApproving,
    isRejecting,
    isBulkApproving,
    isBulkRejecting,
  } = useTimeTracking();
  const tCommon = useTranslations('Common');
  const tProfile = useTranslations('ContractorProfile');

  const hasStatusFilter = statusFilter !== TIME_STATUS_FILTER_ALL;
  const showPendingFeaturedEmpty =
    !(pendingQuery.isLoading || pendingQuery.isError) && pendingTimesheets.length === 0;
  const showAllFeaturedEmpty =
    !(allQuery.isLoading || allQuery.isError) && allTimesheets.length === 0 && !hasStatusFilter;
  const showAllFilteredEmpty =
    !(allQuery.isLoading || allQuery.isError) && allTimesheets.length === 0 && hasStatusFilter;
  const allControlsDisabled = isListControlsDisabled({
    isLoading: allQuery.isLoading,
    isFetching: allQuery.isFetching,
  });

  const statusFilterLabel =
    {
      [TIME_STATUS_FILTER_ALL]: t('filters.allStatuses'),
      DRAFT: t('filters.draft'),
      SUBMITTED: t('filters.submitted'),
      APPROVED: t('filters.approved'),
      REJECTED: t('filters.rejected'),
    }[statusFilter] ?? t('filters.statusPlaceholder');

  const allColumns = useMemo<ColumnDef<TimesheetRow, unknown>[]>(
    () => [
      {
        id: 'contractor',
        accessorFn: row => row.contractor.legalName,
        header: t('columns.contractor'),
        cell: ({ row }) => (
          <span className="text-sm font-medium">{row.original.contractor.legalName}</span>
        ),
      },
      {
        id: 'period',
        accessorFn: row => new Date(row.weekStartDate).getTime(),
        header: t('columns.period'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatPeriod(row.original.weekStartDate)}
          </span>
        ),
      },
      {
        id: 'totalHours',
        accessorKey: 'totalMinutes',
        header: () => <span className="block text-end">{t('columns.totalHours')}</span>,
        cell: ({ row }) => (
          <span className="block text-end text-sm font-medium">
            {minutesToDisplay(row.original.totalMinutes)}
          </span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: t('columns.status'),
        cell: ({ row }) => <TimeEntryStatusBadge status={row.original.status} />,
      },
    ],
    [t],
  );

  const handleAllPageIndexChange = useCallback(
    (next: number) => handleAllPageChange(next + 1),
    [handleAllPageChange],
  );

  const handleTabChange = useCallback((value: string) => void setTab(value), [setTab]);
  const handleStatusFilterChange = useCallback(
    (v: string | null) => {
      if (v) void setStatusFilter(v);
    },
    [setStatusFilter],
  );
  const handleRefetchPending = useCallback(() => void pendingQuery.refetch(), [pendingQuery]);
  const handleRefetchAll = useCallback(() => void allQuery.refetch(), [allQuery]);

  return (
    <div className={WORKBENCH_TABLE_PAGE_FILL_CLASS}>
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('pageTitle')} description={t('pageDescription')} />
      </AnimateIn>

      <AnimateIn delay={2} className="flex min-h-0 flex-1 flex-col">
        <Tabs value={tab} onValueChange={handleTabChange} className={WORKBENCH_TABLE_TABS_CLASS}>
          <TabsList className="shrink-0">
            <TabsTrigger value="pending">
              {t('tabs.pendingReviews')}
              {pendingTimesheets.length > 0 && (
                <span className="ms-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
                  {pendingTimesheets.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">{t('tabs.allEntries')}</TabsTrigger>
            <TabsTrigger value="reconciliation">{t('tabs.reconciliation')}</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className={WORKBENCH_TABLE_TAB_PANEL_CLASS}>
            {showPendingFeaturedEmpty ? (
              <AtelierEmptyState
                variant="page"
                illustration={TimeTrackingIllustration}
                heading={t('emptyStates.noPendingReviewsHeading')}
                body={t('emptyStates.noPendingReviewsBody')}
                renderAction={renderEmptyStateAction}
              />
            ) : (
              <section className={WORKBENCH_TABLE_SECTION_CLASS}>
                <SectionLabel icon={Clock}>{t('tabs.pendingReviews')}</SectionLabel>
                {pendingQuery.isError ? (
                  <QueryErrorPanel
                    message={tCommon('networkError')}
                    retryLabel={tProfile('error.retry')}
                    onRetry={handleRefetchPending}
                  />
                ) : (
                  <ApprovalQueueTable
                    timesheets={pendingTimesheets}
                    isLoading={pendingQuery.isLoading}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onBulkApprove={handleBulkApprove}
                    onBulkReject={handleBulkReject}
                    onNavigateToReview={handleNavigateToReview}
                    isApproving={isApproving}
                    isRejecting={isRejecting}
                    isBulkApproving={isBulkApproving}
                    isBulkRejecting={isBulkRejecting}
                    sectionClassName=""
                  />
                )}
              </section>
            )}
          </TabsContent>

          <TabsContent value="all" className={WORKBENCH_TABLE_TAB_PANEL_CLASS}>
            {showAllFeaturedEmpty ? (
              <AtelierEmptyState
                variant="page"
                illustration={TimeTrackingIllustration}
                heading={t('emptyStates.noTimeEntriesHeading')}
                body={t('emptyStates.noTimeEntriesBody')}
                renderAction={renderEmptyStateAction}
              />
            ) : (
              <section className={WORKBENCH_TABLE_SECTION_CLASS}>
                <SectionLabel icon={Clock}>{t('tabs.allEntries')}</SectionLabel>
                <div className="flex items-center gap-3">
                  <Select
                    value={statusFilter}
                    disabled={allControlsDisabled}
                    onValueChange={handleStatusFilterChange}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder={t('filters.statusPlaceholder')}>
                        {statusFilterLabel}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TIME_STATUS_FILTER_ALL}>
                        {t('filters.allStatuses')}
                      </SelectItem>
                      <SelectItem value="DRAFT">{t('filters.draft')}</SelectItem>
                      <SelectItem value="SUBMITTED">{t('filters.submitted')}</SelectItem>
                      <SelectItem value="APPROVED">{t('filters.approved')}</SelectItem>
                      <SelectItem value="REJECTED">{t('filters.rejected')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {allQuery.isError ? (
                  <QueryErrorPanel
                    message={tCommon('networkError')}
                    retryLabel={tProfile('error.retry')}
                    onRetry={handleRefetchAll}
                  />
                ) : showAllFilteredEmpty ? (
                  <AtelierEmptyState
                    variant="subview"
                    illustration={TimeTrackingIllustration}
                    heading={t('filters.noResultsHeading')}
                    body={t('filters.noResultsBody')}
                    primaryAction={{
                      label: t('filters.allStatuses'),
                      onClick: () => void setStatusFilter(TIME_STATUS_FILTER_ALL),
                    }}
                    renderAction={renderEmptyStateAction}
                  />
                ) : (
                  <DataTable
                    columns={allColumns}
                    data={allTimesheets}
                    totalRows={allTotalCount}
                    pageIndex={Math.max(0, allCurrentPage - 1)}
                    pageSize={allPageSize}
                    onPageChange={handleAllPageIndexChange}
                    onPageSizeChange={handleAllPageSizeChange}
                    isLoading={allQuery.isLoading}
                    fill
                    getRowId={row => row.id}
                    entityLabel={t('timesheetEntityLabel', { count: allTotalCount })}
                    emptyTitle={t('emptyStates.noTimeEntriesHeading')}
                    emptyDescription={t('emptyStates.noTimeEntriesBody')}
                    noResultsTitle={t('filters.noResultsHeading')}
                    noResultsDescription={t('filters.noResultsBody')}
                  />
                )}
              </section>
            )}
          </TabsContent>

          <TabsContent value="reconciliation" className={WORKBENCH_TABLE_TAB_PANEL_CLASS}>
            <section className={WORKBENCH_TABLE_SECTION_CLASS}>
              <SectionLabel icon={Clock}>{t('tabs.reconciliation')}</SectionLabel>
              <ReconciliationSpotCheck />
              <div className="mt-6">
                <ReconciliationTable sectionClassName="" />
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </AnimateIn>
    </div>
  );
}

export default function TimePage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <TimePageContent />
    </Suspense>
  );
}

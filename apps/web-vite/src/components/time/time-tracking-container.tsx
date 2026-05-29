/**
 * Admin time tracking page. Ported from
 * apps/web/src/app/[locale]/(dashboard)/time/page.tsx:
 *   - next-intl → ../../i18n/useTranslations.js
 *   - @/i18n/navigation → ../../i18n/navigation.js
 *   - @/trpc/init → ../../providers/trpc-provider.js#useTRPC
 */

import {
  AtelierEmptyState,
  QueryErrorPanel,
  SectionLabel,
  TimeTrackingIllustration,
  WORKBENCH_TABLE_PAGE_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
  WORKBENCH_TABLE_TAB_PANEL_CLASS,
  WORKBENCH_TABLE_TABS_CLASS,
} from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import { addDays, format, startOfISOWeek } from 'date-fns';
import { Clock } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { AnimateIn } from '../shared/animate-in.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { DataTablePagination } from '../shared/data-table-pagination.js';
import { isListControlsDisabled } from '../shared/list-controls-disabled.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { ApprovalQueueTable } from './approval-queue-table.js';
import { TIME_STATUS_FILTER_ALL, useTimeTracking } from './hooks/use-time-tracking.js';
import { ReconciliationSpotCheck } from './reconciliation-spot-check-container.js';
import { ReconciliationTable } from './reconciliation-table-container.js';
import { TimeEntryStatusBadge } from './time-entry-status-badge.js';

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

export function TimeTrackingContainer() {
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
    <div className={WORKBENCH_TABLE_PAGE_CLASS}>
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
                  <div className="rounded-xl border bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('columns.contractor')}</TableHead>
                          <TableHead>{t('columns.period')}</TableHead>
                          <TableHead className="text-end">{t('columns.totalHours')}</TableHead>
                          <TableHead>{t('columns.status')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allQuery.isLoading
                          ? Array.from({ length: 8 }).map((_, i) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                              <TableRow key={`all-skeleton-${i}`}>
                                <TableCell>
                                  <Skeleton className="h-4 w-32" />
                                </TableCell>
                                <TableCell>
                                  <Skeleton className="h-4 w-24" />
                                </TableCell>
                                <TableCell>
                                  <Skeleton className="ms-auto h-4 w-16" />
                                </TableCell>
                                <TableCell>
                                  <Skeleton className="h-5 w-16 rounded-full" />
                                </TableCell>
                              </TableRow>
                            ))
                          : allTimesheets.map(ts => (
                              <TableRow key={ts.id}>
                                <TableCell className="text-sm font-medium">
                                  {ts.contractor.legalName}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {formatPeriod(ts.weekStartDate)}
                                </TableCell>
                                <TableCell className="text-end text-sm font-medium">
                                  {minutesToDisplay(ts.totalMinutes)}
                                </TableCell>
                                <TableCell>
                                  <TimeEntryStatusBadge status={ts.status} />
                                </TableCell>
                              </TableRow>
                            ))}
                      </TableBody>
                    </Table>
                    {!allQuery.isLoading && allTimesheets.length > 0 ? (
                      <DataTablePagination
                        totalRows={allTotalCount}
                        pageSize={allPageSize}
                        currentPage={allCurrentPage}
                        onPageChange={handleAllPageChange}
                        onPageSizeChange={handleAllPageSizeChange}
                      />
                    ) : null}
                  </div>
                )}
              </section>
            )}
          </TabsContent>

          <TabsContent value="reconciliation" className={WORKBENCH_TABLE_TAB_PANEL_CLASS}>
            <section className={WORKBENCH_TABLE_SECTION_CLASS}>
              <SectionLabel icon={Clock}>{t('tabs.reconciliation')}</SectionLabel>
              <ReconciliationSpotCheck />
              <div className="mt-6">
                <ReconciliationTable />
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </AnimateIn>
    </div>
  );
}

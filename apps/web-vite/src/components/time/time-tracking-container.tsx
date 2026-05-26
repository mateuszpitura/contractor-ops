/**
 * Admin time tracking page. Ported from
 * apps/web/src/app/[locale]/(dashboard)/time/page.tsx:
 *   - next-intl → ../../i18n/useTranslations.js
 *   - @/i18n/navigation → ../../i18n/navigation.js
 *   - @/trpc/init → ../../providers/trpc-provider.js#useTRPC
 */

import {
  AtelierEmptyState,
  AtelierPageHeader,
  QueryErrorPanel,
  SectionLabel,
  TimeTrackingIllustration,
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
import { useTranslations } from '../../i18n/useTranslations.js';
import { AnimateIn } from '../shared/animate-in.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { ApprovalQueueTable } from './approval-queue-table.js';
import { useTimeTracking } from './hooks/use-time-tracking.js';
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
    handleLoadMoreAll,
    hasMoreAll,
    isFetchingMoreAll,
    isApproving,
    isRejecting,
    isBulkApproving,
    isBulkRejecting,
  } = useTimeTracking();
  const tSettings = useTranslations('Settings.provider');
  const tTransmissions = useTranslations('EInvoice.TransmissionsLog');
  const tCommon = useTranslations('Common');
  const tProfile = useTranslations('ContractorProfile');

  return (
    <div className="space-y-section-gap">
      <AnimateIn delay={0}>
        <AtelierPageHeader title={t('pageTitle')} description={t('pageDescription')} />
      </AnimateIn>

      <AnimateIn delay={2}>
        {/* biome-ignore lint/nursery/noJsxPropsBind: controlled component handler */}
        <Tabs value={tab} onValueChange={value => void setTab(value)}>
          <TabsList>
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

          <TabsContent value="pending" className="mt-4">
            <div className="space-y-card-gap">
              <SectionLabel icon={Clock}>{t('tabs.pendingReviews')}</SectionLabel>
              {pendingQuery.isLoading ? (
                <LoadingSkeleton />
              ) : pendingQuery.isError ? (
                <QueryErrorPanel
                  message={tCommon('networkError')}
                  retryLabel={tProfile('error.retry')}
                  onRetry={() => void pendingQuery.refetch()}
                />
              ) : pendingTimesheets.length === 0 ? (
                <AtelierEmptyState
                  illustration={TimeTrackingIllustration}
                  heading={t('emptyStates.noPendingReviewsHeading')}
                  body={t('emptyStates.noPendingReviewsBody')}
                  renderAction={renderEmptyStateAction}
                />
              ) : (
                <ApprovalQueueTable
                  timesheets={pendingTimesheets}
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
            </div>
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <div className="space-y-card-gap">
              <SectionLabel icon={Clock}>{t('tabs.allEntries')}</SectionLabel>
              <div className="flex items-center gap-3">
                {/* biome-ignore lint/nursery/noJsxPropsBind: controlled component handler */}
                <Select value={statusFilter} onValueChange={v => void setStatusFilter(v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={t('filters.statusPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
                    <SelectItem value="DRAFT">{t('filters.draft')}</SelectItem>
                    <SelectItem value="SUBMITTED">{t('filters.submitted')}</SelectItem>
                    <SelectItem value="APPROVED">{t('filters.approved')}</SelectItem>
                    <SelectItem value="REJECTED">{t('filters.rejected')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {allQuery.isLoading ? (
                <LoadingSkeleton />
              ) : allQuery.isError ? (
                <QueryErrorPanel
                  message={tCommon('networkError')}
                  retryLabel={tProfile('error.retry')}
                  onRetry={() => void allQuery.refetch()}
                />
              ) : allTimesheets.length === 0 ? (
                <AtelierEmptyState
                  illustration={TimeTrackingIllustration}
                  heading={t('emptyStates.noTimeEntriesHeading')}
                  body={t('emptyStates.noTimeEntriesBody')}
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
                      {allTimesheets.map(ts => (
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
                  {hasMoreAll ? (
                    <div className="flex justify-center border-t p-4">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={isFetchingMoreAll}
                        onClick={handleLoadMoreAll}>
                        {isFetchingMoreAll ? tTransmissions('loadingMore') : tSettings('loadMore')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="reconciliation" className="mt-4">
            <div className="space-y-section-gap">
              <SectionLabel icon={Clock}>{t('tabs.reconciliation')}</SectionLabel>
              <ReconciliationSpotCheck />
              <ReconciliationTable />
            </div>
          </TabsContent>
        </Tabs>
      </AnimateIn>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
        <div key={`skel-${i}`} className="flex items-center gap-4 rounded-lg border px-4 py-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, startOfISOWeek } from 'date-fns';
import { ClipboardList, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { Suspense, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { AnimateIn } from '@/components/shared/animate-in';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import type { TimesheetRow } from '@/components/time/approval-queue-table';
import { ApprovalQueueTable } from '@/components/time/approval-queue-table';
import { ReconciliationTable } from '@/components/time/reconciliation-table';
import { TimeEntryStatusBadge } from '@/components/time/time-entry-status-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Inner content (uses nuqs, needs Suspense boundary)
// ---------------------------------------------------------------------------

function TimeTrackingContent() {
  const t = useTranslations('Time');
  const router = useRouter();
  const queryClient = useQueryClient();

  // URL state
  const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('pending'));
  const [statusFilter, setStatusFilter] = useQueryState('status', parseAsString.withDefault('all'));

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  const pendingQuery = useQuery({
    ...trpc.time.listPending.queryOptions(),
    refetchInterval: 30000,
  });

  const allQuery = useQuery({
    ...trpc.time.listAll.queryOptions({
      ...(statusFilter === 'all'
        ? {}
        : {
            status: statusFilter as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED',
          }),
    }),
    enabled: tab === 'all',
    refetchInterval: 30000,
  });

  const pendingTimesheets = useMemo(
    () => (pendingQuery.data ?? []) as TimesheetRow[],
    [pendingQuery.data],
  );

  const allTimesheets = useMemo(() => {
    const data = allQuery.data as { items: TimesheetRow[]; nextCursor?: string } | undefined;
    return data?.items ?? [];
  }, [allQuery.data]);

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [['time', 'listPending']],
    });
    void queryClient.invalidateQueries({
      queryKey: [['time', 'listAll']],
    });
  }, [queryClient]);

  const approveMutation = useMutation(
    trpc.time.approve.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.approved'));
        invalidate();
      },
      onError: () => toast.error(t('errors.failedToApprove')),
    }),
  );

  const rejectMutation = useMutation(
    trpc.time.reject.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.rejected'));
        invalidate();
      },
      onError: () => toast.error(t('errors.failedToReject')),
    }),
  );

  const bulkApproveMutation = useMutation(
    trpc.time.bulkApprove.mutationOptions({
      onSuccess: data => {
        const result = data as { count: number };
        toast.success(t('toast.bulkApproved', { count: result.count }));
        invalidate();
      },
      onError: () => toast.error(t('errors.failedToApproveTimesheets')),
    }),
  );

  const bulkRejectMutation = useMutation(
    trpc.time.bulkReject.mutationOptions({
      onSuccess: data => {
        const result = data as { count: number };
        toast.success(t('toast.bulkRejected', { count: result.count }));
        invalidate();
      },
      onError: () => toast.error(t('errors.failedToRejectTimesheets')),
    }),
  );

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleApprove = useCallback(
    (timesheetId: string) => {
      approveMutation.mutate({ timesheetId });
    },
    [approveMutation],
  );

  const handleReject = useCallback(
    (timesheetId: string, reason: string) => {
      rejectMutation.mutate({ timesheetId, reason });
    },
    [rejectMutation],
  );

  const handleBulkApprove = useCallback(
    (timesheetIds: string[]) => {
      bulkApproveMutation.mutate({ timesheetIds });
    },
    [bulkApproveMutation],
  );

  const handleBulkReject = useCallback(
    (timesheetIds: string[], reason: string) => {
      bulkRejectMutation.mutate({ timesheetIds, reason });
    },
    [bulkRejectMutation],
  );

  const handleNavigateToReview = useCallback(
    (contractorId: string, weekStartDate: string) => {
      router.push(`/time/${contractorId}?week=${weekStartDate}`);
    },
    [router],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <PageHeader title={t('pageTitle')} />
      </AnimateIn>

      <AnimateIn delay={1}>
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

          {/* Tab 1: Pending Reviews */}
          <TabsContent value="pending" className="mt-4">
            {pendingQuery.isLoading ? (
              <LoadingSkeleton />
            ) : pendingTimesheets.length === 0 ? (
              <EmptyState
                icon={Clock}
                heading={t('emptyStates.noPendingReviewsHeading')}
                body={t('emptyStates.noPendingReviewsBody')}
              />
            ) : (
              <ApprovalQueueTable
                timesheets={pendingTimesheets}
                onApprove={handleApprove}
                onReject={handleReject}
                onBulkApprove={handleBulkApprove}
                onBulkReject={handleBulkReject}
                onNavigateToReview={handleNavigateToReview}
              />
            )}
          </TabsContent>

          {/* Tab 2: All Entries */}
          <TabsContent value="all" className="mt-4">
            <div className="space-y-4">
              {/* Filters */}
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
              ) : allTimesheets.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  heading={t('emptyStates.noTimeEntriesHeading')}
                  body={t('emptyStates.noTimeEntriesBody')}
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
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab 3: Reconciliation */}
          <TabsContent value="reconciliation" className="mt-4">
            <ReconciliationTable />
          </TabsContent>
        </Tabs>
      </AnimateIn>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

/**
 * Admin time tracking page at /time.
 * 3 tabs: Pending Reviews, All Entries, Reconciliation (placeholder).
 */
export default function TimePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-10 w-80" />
          <LoadingSkeleton />
        </div>
      }>
      <TimeTrackingContent />
    </Suspense>
  );
}

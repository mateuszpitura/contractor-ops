'use client';

import {
  ApprovalsIllustration,
  AtelierEmptyState,
  AtelierPageHeader,
  SectionLabel,
} from '@contractor-ops/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryState } from 'nuqs';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { ApprovalQueueRow } from '@/components/approvals/approval-queue/columns';
import { getColumns } from '@/components/approvals/approval-queue/columns';
import { ApprovalQueueTable } from '@/components/approvals/approval-queue/data-table';
import { ApprovalQueueToolbar } from '@/components/approvals/approval-queue/data-table-toolbar';
import { ApprovalSidePanel } from '@/components/approvals/approval-queue/side-panel';
import { ChangeRequestDiffCard } from '@/components/settings/change-request-diff-card';
import { AnimateIn } from '@/components/shared/animate-in';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { PageLoadingSpinner } from '@/components/shared/page-loading-spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissions } from '@/hooks/use-permissions';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Inner content (uses nuqs, needs Suspense boundary)
// ---------------------------------------------------------------------------

/** Client-side status filter for multi-select (API only accepts a single value). */
function matchesStatusFilter(row: ApprovalQueueRow, filterSet: Set<string>): boolean {
  const isOverdue =
    row.status === 'PENDING' && !!row.slaDeadline && new Date(row.slaDeadline) < new Date();
  if (filterSet.has('overdue') && isOverdue) return true;
  if (filterSet.has('pending') && row.status === 'PENDING') return true;
  if (filterSet.has('approved') && row.status === 'APPROVED') return true;
  if (filterSet.has('rejected') && row.status === 'REJECTED') return true;
  return false;
}

function ApprovalsContent() {
  const t = useTranslations('Approvals');
  const te = useTranslations('EmptyStates');
  const locale = useLocale();
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  // URL state via nuqs
  const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('my'));
  const [statuses, setStatuses] = useQueryState(
    'status',
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState('pageSize', parseAsInteger.withDefault(10));

  // Side panel state
  const [selectedStep, setSelectedStep] = useState<ApprovalQueueRow | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

  // Admin-only "All" tab visibility
  const isAdmin = can('settings', ['read']);

  // -------------------------------------------------------------------------
  // Change request query (admin only)
  // -------------------------------------------------------------------------

  const changeRequestsQuery = useQuery({
    ...trpc.settings.listChangeRequests.queryOptions({ status: 'PENDING' }),
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const changeRequests = (changeRequestsQuery.data ?? []) as unknown as Array<{
    id: string;
    contractorName: string;
    contractorEmail: string;
    requestedChanges: Record<string, unknown>;
    previousValues: Record<string, unknown>;
    createdAt: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
  }>;

  const pendingCount = changeRequests.length;

  // Map multi-select statuses to single API value.
  // API accepts one enum; when 0 or 2+ selected, send 'all' and filter client-side.
  const apiStatus: 'all' | 'pending' | 'overdue' | 'approved' | 'rejected' =
    statuses.length === 1
      ? (statuses[0] as 'pending' | 'overdue' | 'approved' | 'rejected')
      : 'all';

  // Build query input
  const queryInput = useMemo(
    () => ({
      tab: tab as 'my' | 'all',
      status: apiStatus,
      search: search || undefined,
      page,
      pageSize,
      sortBy: 'slaDeadline' as const,
      sortOrder: 'asc' as const,
    }),
    [tab, apiStatus, search, page, pageSize],
  );

  // Fetch queue data
  const queueQuery = useQuery({
    ...trpc.approval.listPending.queryOptions(queryInput),
    refetchInterval: 30000,
  });

  const data = useMemo(() => {
    const result = queueQuery.data as
      | { items: ApprovalQueueRow[]; total: number; page: number; pageSize: number }
      | undefined;
    const items = result?.items ?? [];
    // Client-side filter when 2+ statuses selected (API only accepts single value)
    if (statuses.length <= 1) return items;
    const filterSet = new Set(statuses);
    return items.filter(row => matchesStatusFilter(row, filterSet));
  }, [queueQuery.data, statuses]);

  const totalRows = useMemo(() => {
    const result = queueQuery.data as { items: unknown[]; total: number } | undefined;
    return result?.total ?? 0;
  }, [queueQuery.data]);

  const pageCount = Math.ceil(totalRows / pageSize);

  // Inline approve mutation
  const approveMutation = useMutation(
    trpc.approval.approve.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.approved'));
        void queryClient.invalidateQueries({
          queryKey: [['approval', 'listPending']],
        });
      },
      onError: () => {
        toast.error(t('errors.failedToApprove'));
      },
    }),
  );

  // Inline reject mutation
  const rejectMutation = useMutation(
    trpc.approval.reject.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.rejected'));
        void queryClient.invalidateQueries({
          queryKey: [['approval', 'listPending']],
        });
      },
      onError: () => {
        toast.error(t('errors.failedToReject'));
      },
    }),
  );

  // Column definitions with action callbacks
  const columns = useMemo(
    () =>
      getColumns(
        (key: string) => t(key),
        {
          onApprove: stepId => approveMutation.mutate({ stepId }),
          onReject: (stepId, comment) => rejectMutation.mutate({ stepId, comment }),
        },
        locale,
      ),
    [t, approveMutation, rejectMutation, locale],
  );

  // Row click handler for side panel
  const handleRowClick = useCallback((row: ApprovalQueueRow) => {
    setSelectedStep(row);
    setSidePanelOpen(true);
  }, []);

  // Pagination handlers
  const handlePageChange = useCallback((newPage: number) => void setPage(newPage), [setPage]);

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      void setPageSize(newSize);
      void setPage(1);
    },
    [setPageSize, setPage],
  );

  // Status filter handler (multi-select)
  const handleStatusChange = useCallback(
    (newStatuses: string[]) => {
      void setStatuses(newStatuses);
      void setPage(1);
    },
    [setStatuses, setPage],
  );

  // Search handler
  const handleSearchChange = useCallback(
    (value: string) => {
      void setSearch(value);
      void setPage(1);
    },
    [setSearch, setPage],
  );

  // Tab change handler
  const handleTabChange = useCallback(
    (value: string) => {
      void setTab(value);
      void setPage(1);
    },
    [setTab, setPage],
  );

  // Change request invalidation handler
  const handleChangeRequestInvalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.settings.listChangeRequests.queryKey(),
    });
  }, [queryClient]);

  // Side panel open change handler
  const handleSidePanelOpenChange = useCallback((open: boolean) => {
    setSidePanelOpen(open);
    if (!open) setSelectedStep(null);
  }, []);

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Clear selection when tab, status, search, or page changes
  useEffect(() => {
    setSelectedIds([]);
  }, []);

  const isLoading = queueQuery.isLoading;
  const isEmpty = !isLoading && data.length === 0;

  // Render queue content (shared between tabs)
  const renderQueue = () => {
    if (isEmpty && statuses.length === 0 && !search) {
      // True empty state - informational only, no CTA
      return (
        <AtelierEmptyState
          illustration={ApprovalsIllustration}
          heading={te('approvals.heading')}
          body={te('approvals.body')}
          renderAction={renderEmptyStateAction}
        />
      );
    }

    return (
      <section aria-label={t('pageTitle')} className="space-y-4">
        <SectionLabel icon={ClipboardCheck}>{t('pageTitle')}</SectionLabel>
        <ApprovalQueueToolbar
          activeStatuses={statuses}
          onStatusChange={handleStatusChange}
          search={search}
          onSearchChange={handleSearchChange}
          isSearching={queueQuery.isFetching && !isLoading}
          selectedIds={selectedIds}
          // biome-ignore lint/nursery/noJsxPropsBind: simple state reset, component not memoized
          onClearSelection={() => setSelectedIds([])}
          isLoading={isLoading}
        />
        <ApprovalQueueTable
          data={data}
          columns={columns}
          pageCount={pageCount}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onRowClick={handleRowClick}
          onSelectionChange={setSelectedIds}
          isLoading={isLoading}
        />
      </section>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <AnimateIn delay={0}>
        <AtelierPageHeader title={t('pageTitle')} description={t('pageDescription')} />
      </AnimateIn>

      {/* Tabs */}
      <AnimateIn delay={1}>
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="my">{t('tabMy')}</TabsTrigger>
            {isAdmin && <TabsTrigger value="all">{t('tabAll')}</TabsTrigger>}
            {isAdmin && (
              <TabsTrigger value="profile-changes">
                {t('tabProfileChanges')}
                {pendingCount > 0 && (
                  <span className="ms-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="my" className="mt-4">
            {renderQueue()}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="all" className="mt-4">
              {renderQueue()}
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="profile-changes" className="mt-4">
              {changeRequestsQuery.isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                    <Skeleton key={`skel-${i}`} className="h-48 w-full rounded-xl" />
                  ))}
                </div>
              ) : changeRequests.length === 0 ? (
                <AtelierEmptyState
                  illustration={ApprovalsIllustration}
                  heading={t('changeRequests.noPendingHeading')}
                  body={t('changeRequests.noPendingBody')}
                  renderAction={renderEmptyStateAction}
                />
              ) : (
                <div className="space-y-4">
                  {changeRequests.map(req => (
                    <ChangeRequestDiffCard
                      key={req.id}
                      request={req}
                      onApproved={handleChangeRequestInvalidate}
                      onRejected={handleChangeRequestInvalidate}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </AnimateIn>

      {/* Side panel */}
      <ApprovalSidePanel
        step={sidePanelOpen ? selectedStep : null}
        open={sidePanelOpen}
        onOpenChange={handleSidePanelOpenChange}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

/**
 * Approvals queue page at /approvals.
 * Wrapped in Suspense to handle nuqs useSearchParams usage.
 */
export default function ApprovalsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <ApprovalsContent />
    </Suspense>
  );
}

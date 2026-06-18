/**
 * Approvals queue — route shell with inlined page content.
 */

import {
  ApprovalsIllustration,
  AtelierEmptyState,
  SectionLabel,
  WORKBENCH_DATA_TABLE_CLASS,
  WORKBENCH_TABLE_PAGE_FILL_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
  WORKBENCH_TABLE_TAB_PANEL_CLASS,
  WORKBENCH_TABLE_TABS_CLASS,
} from '@contractor-ops/ui';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@contractor-ops/ui/components/shadcn/tabs';
import { ClipboardCheck } from 'lucide-react';
import { Suspense } from 'react';

import { ApprovalQueueTable } from '../../components/approvals/approval-queue/data-table.js';
import { ApprovalBulkActions } from '../../components/approvals/approval-queue/data-table-bulk-actions.js';
import { ApprovalQueueToolbar } from '../../components/approvals/approval-queue/data-table-toolbar.js';
import { ApprovalSidePanel } from '../../components/approvals/approval-queue/side-panel.js';
import { useApprovalQueue } from '../../components/approvals/hooks/use-approval-queue.js';
import { ChangeRequestDiffCard } from '../../components/settings/change-request-diff-card.js';
import { AnimateIn } from '../../components/shared/animate-in.js';
import { renderEmptyStateAction } from '../../components/shared/atelier-bridges.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../components/shared/workbench-page-header.js';
import { useTranslations } from '../../i18n/useTranslations.js';

const CHANGE_REQUEST_SKELETON_KEYS = ['cr-a', 'cr-b', 'cr-c'] as const;

function ApprovalsPageContent() {
  const t = useTranslations('Approvals');
  const te = useTranslations('EmptyStates');
  const queue = useApprovalQueue();

  const renderQueue = () => {
    if (queue.showQueueEmptyState) {
      return (
        <AtelierEmptyState
          illustration={ApprovalsIllustration}
          heading={te('approvals.heading')}
          body={te('approvals.body')}
          renderAction={renderEmptyStateAction}
        />
      );
    }

    const {
      statuses,
      search,
      selectedIds,
      data,
      columns,
      pageCount,
      page,
      pageSize,
      totalRows,
      isLoading,
      isSearching,
      onStatusChange,
      onSearchChange,
      onClearSelection,
      onClearFilters,
      onPageChange,
      onPageSizeChange,
      onRowClick,
      onSelectionChange,
      bulkActions,
    } = queue.queueSectionProps;

    return (
      <section aria-label={t('pageTitle')} className={WORKBENCH_TABLE_SECTION_CLASS}>
        <SectionLabel icon={ClipboardCheck}>{t('pageTitle')}</SectionLabel>
        <div className={WORKBENCH_DATA_TABLE_CLASS}>
          <ApprovalQueueToolbar
            activeStatuses={statuses}
            onStatusChange={onStatusChange}
            search={search}
            onSearchChange={onSearchChange}
            isSearching={isSearching}
            isLoading={isLoading}
          />
          {selectedIds.length > 0 ? (
            <div className="shrink-0">
              <ApprovalBulkActions
                selectedIds={selectedIds}
                onClearSelection={onClearSelection}
                bulkActions={bulkActions}
              />
            </div>
          ) : null}
          <ApprovalQueueTable
            data={data}
            columns={columns}
            pageCount={pageCount}
            page={page}
            pageSize={pageSize}
            totalCount={totalRows}
            hasActiveFilters={statuses.length > 0 || search.length > 0}
            activeFilterCount={(statuses.length > 0 ? 1 : 0) + (search.length > 0 ? 1 : 0)}
            onClearFilters={onClearFilters}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            onRowClick={onRowClick}
            onSelectionChange={onSelectionChange}
            isLoading={isLoading}
            sectionClassName=""
          />
        </div>
      </section>
    );
  };

  return (
    <div className={WORKBENCH_TABLE_PAGE_FILL_CLASS}>
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('pageTitle')} description={t('pageDescription')} />
      </AnimateIn>

      <AnimateIn delay={1} className="flex min-h-0 flex-1 flex-col">
        <Tabs
          value={queue.tab}
          onValueChange={queue.onTabChange}
          className={WORKBENCH_TABLE_TABS_CLASS}>
          <TabsList className="shrink-0">
            <TabsTrigger value="my">{t('tabMy')}</TabsTrigger>
            {queue.isAdmin ? <TabsTrigger value="all">{t('tabAll')}</TabsTrigger> : null}
            {queue.isAdmin ? (
              <TabsTrigger value="profile-changes">
                {t('tabProfileChanges')}
                {queue.pendingCount > 0 && (
                  <span className="ms-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
                    {queue.pendingCount}
                  </span>
                )}
              </TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="my" className={WORKBENCH_TABLE_TAB_PANEL_CLASS}>
            {renderQueue()}
          </TabsContent>

          {queue.isAdmin ? (
            <TabsContent value="all" className={WORKBENCH_TABLE_TAB_PANEL_CLASS}>
              {renderQueue()}
            </TabsContent>
          ) : null}

          {queue.isAdmin ? (
            <TabsContent value="profile-changes" className="mt-4">
              {queue.changeRequestsLoading ? (
                <div className="space-y-4">
                  {CHANGE_REQUEST_SKELETON_KEYS.map(key => (
                    <Skeleton key={key} className="h-48 w-full rounded-xl" />
                  ))}
                </div>
              ) : queue.changeRequests.length === 0 ? (
                <AtelierEmptyState
                  illustration={ApprovalsIllustration}
                  heading={t('changeRequests.noPendingHeading')}
                  body={t('changeRequests.noPendingBody')}
                  renderAction={renderEmptyStateAction}
                />
              ) : (
                <div className="space-y-4">
                  {queue.changeRequests.map(req => (
                    <ChangeRequestDiffCard
                      key={req.id}
                      request={req}
                      onApproved={queue.onChangeRequestInvalidate}
                      onRejected={queue.onChangeRequestInvalidate}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ) : null}
        </Tabs>
      </AnimateIn>

      <ApprovalSidePanel {...queue.sidePanelProps} />
    </div>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <ApprovalsPageContent />
    </Suspense>
  );
}

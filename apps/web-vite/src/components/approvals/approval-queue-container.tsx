import {
  ApprovalsIllustration,
  AtelierEmptyState,
  AtelierPageHeader,
  SectionLabel,
  WORKBENCH_DATA_TABLE_CLASS,
  WORKBENCH_TABLE_PAGE_CLASS,
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
import { useTranslations } from '../../i18n/useTranslations.js';
import { ChangeRequestDiffCardContainer } from '../settings/change-request-diff-card-container.js';
import { AnimateIn } from '../shared/animate-in.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { ApprovalQueueTable } from './approval-queue/data-table.js';
import { ApprovalQueueToolbar } from './approval-queue/data-table-toolbar.js';
import { ApprovalSidePanelContainer } from './approval-queue/side-panel-container.js';
import { useApprovalQueue } from './hooks/use-approval-queue.js';

export function ApprovalQueueContainer() {
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
            selectedIds={selectedIds}
            onClearSelection={onClearSelection}
            isLoading={isLoading}
            bulkActions={bulkActions}
          />
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
          />
        </div>
      </section>
    );
  };

  return (
    <div className={WORKBENCH_TABLE_PAGE_CLASS}>
      <AnimateIn delay={0}>
        <AtelierPageHeader title={t('pageTitle')} description={t('pageDescription')} />
      </AnimateIn>

      <AnimateIn delay={1} className="flex min-h-0 flex-1 flex-col">
        <Tabs
          value={queue.tab}
          onValueChange={queue.onTabChange}
          className={WORKBENCH_TABLE_TABS_CLASS}>
          <TabsList className="shrink-0">
            <TabsTrigger value="my">{t('tabMy')}</TabsTrigger>
            {queue.isAdmin && <TabsTrigger value="all">{t('tabAll')}</TabsTrigger>}
            {queue.isAdmin && (
              <TabsTrigger value="profile-changes">
                {t('tabProfileChanges')}
                {queue.pendingCount > 0 && (
                  <span className="ms-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
                    {queue.pendingCount}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="my" className={WORKBENCH_TABLE_TAB_PANEL_CLASS}>
            {renderQueue()}
          </TabsContent>

          {queue.isAdmin && (
            <TabsContent value="all" className={WORKBENCH_TABLE_TAB_PANEL_CLASS}>
              {renderQueue()}
            </TabsContent>
          )}

          {queue.isAdmin && (
            <TabsContent value="profile-changes" className="mt-4">
              {queue.changeRequestsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                    <Skeleton key={`skel-${i}`} className="h-48 w-full rounded-xl" />
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
                    <ChangeRequestDiffCardContainer
                      key={req.id}
                      request={req}
                      onApproved={queue.onChangeRequestInvalidate}
                      onRejected={queue.onChangeRequestInvalidate}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </AnimateIn>

      <ApprovalSidePanelContainer {...queue.sidePanelProps} />
    </div>
  );
}

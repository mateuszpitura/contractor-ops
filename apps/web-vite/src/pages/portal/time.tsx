/**
 * Portal time tracking — route shell with inlined page content.
 */

import { SectionLabel, TimeTrackingIllustration } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import type { ColumnDef } from '@tanstack/react-table';
import { endOfISOWeek, format, startOfISOWeek } from 'date-fns';
import { AlertCircle, Plus } from 'lucide-react';
import { Suspense, useCallback, useMemo } from 'react';

import { usePortalTime } from '../../components/portal/hooks/use-portal-time.js';
import { AnimateIn } from '../../components/shared/animate-in.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../components/shared/workbench-page-header.js';
import { WorkbenchDataTable } from '../../components/table-kit/workbench-data-table.js';
import { ExternalSyncButton } from '../../components/time/external-sync-button.js';
import { SingleEntryForm } from '../../components/time/single-entry-form.js';
import { TimeEntryStatusBadge } from '../../components/time/time-entry-status-badge.js';
import { TimeSummaryStats } from '../../components/time/time-summary-stats.js';
import { TimesheetGrid } from '../../components/time/timesheet-grid.js';
import { TimesheetHeader } from '../../components/time/timesheet-header.js';
import { useTranslations } from '../../i18n/useTranslations.js';

function formatWeekRange(weekStart: Date | string): string {
  const d = typeof weekStart === 'string' ? new Date(weekStart) : weekStart;
  const weekEnd = endOfISOWeek(d);
  return `${format(d, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
}

function minutesToHoursDisplay(minutes: number): string {
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function formatSubmittedAt(value: Date | string | null | undefined): string {
  if (value == null) return '-';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : format(d, 'MMM d, yyyy');
}

interface TimesheetHistoryRow {
  id: string;
  weekStartDate: Date | string;
  totalMinutes: number;
  status: string;
  submittedAt: Date | string | null | undefined;
}

const noop = (): undefined => undefined;

function getHistoryRowId(row: TimesheetHistoryRow): string {
  return row.id;
}

interface TimesheetHistorySectionProps {
  t: ReturnType<typeof useTranslations>;
  tCommon: ReturnType<typeof useTranslations>;
  isPending: boolean;
  isError: boolean;
  items: TimesheetHistoryRow[];
  onSelectWeek: (weekStartDate: Date | string) => void;
}

function TimesheetHistorySection({
  t,
  tCommon,
  isPending,
  isError,
  items,
  onSelectWeek,
}: TimesheetHistorySectionProps) {
  const columns = useMemo<ColumnDef<TimesheetHistoryRow>[]>(
    () => [
      {
        id: 'period',
        header: () => t('columns.period'),
        cell: ({ row }) => (
          <span className="font-medium">{formatWeekRange(row.original.weekStartDate)}</span>
        ),
      },
      {
        id: 'totalHours',
        header: () => t('columns.totalHours'),
        cell: ({ row }) => minutesToHoursDisplay(row.original.totalMinutes),
      },
      {
        id: 'status',
        header: () => t('columns.status'),
        cell: ({ row }) => (
          <TimeEntryStatusBadge
            status={row.original.status as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'}
          />
        ),
      },
      {
        id: 'submitted',
        header: () => t('columns.submitted'),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatSubmittedAt(row.original.submittedAt)}
          </span>
        ),
      },
    ],
    [t],
  );

  const handleRowClick = useCallback(
    (row: TimesheetHistoryRow) => onSelectWeek(row.weekStartDate),
    [onSelectWeek],
  );

  if (isError) {
    return (
      <div>
        <SectionLabel variant="portal">{t('pastTimesheets')}</SectionLabel>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="mt-3 text-sm text-muted-foreground">{tCommon('somethingWentWrong')}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionLabel variant="portal">{t('pastTimesheets')}</SectionLabel>
      <WorkbenchDataTable
        sectionClassName=""
        columns={columns}
        data={items}
        totalRows={items.length}
        clientPagination
        pageIndex={0}
        pageSize={items.length || 1}
        onPageChange={noop}
        onPageSizeChange={noop}
        isLoading={isPending}
        entityLabel={t('pastTimesheets')}
        hideChrome
        hideFooter
        hideDensityToggle
        constrainHeight={false}
        skeletonRows={5}
        emptyIllustration={TimeTrackingIllustration}
        emptyTitle={t('noEntriesHeading')}
        emptyDescription={t('noEntriesBody')}
        noResultsTitle={t('noEntriesHeading')}
        noResultsDescription={t('noEntriesBody')}
        onRowClick={handleRowClick}
        getRowId={getHistoryRowId}
      />
    </div>
  );
}

type UsePortalTime = ReturnType<typeof usePortalTime>;

function TimesheetWeekSection({
  isLoading,
  currentWeekStart,
  timesheetStatus,
  timesheet,
  contracts,
  isDisabled,
  submitMutation,
  handleWeekChange,
  handleSubmitTimesheet,
  handleSaveEntries,
}: Pick<
  UsePortalTime,
  | 'currentWeekStart'
  | 'timesheetStatus'
  | 'timesheet'
  | 'contracts'
  | 'isDisabled'
  | 'submitMutation'
  | 'handleWeekChange'
  | 'handleSubmitTimesheet'
  | 'handleSaveEntries'
  | 'isLoading'
>) {
  return (
    <div className="space-y-8">
      {isLoading ? (
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
      ) : (
        <TimesheetHeader
          weekStartDate={currentWeekStart}
          status={timesheetStatus}
          totalMinutes={timesheet?.totalMinutes ?? 0}
          onWeekChange={handleWeekChange}
          onSubmit={handleSubmitTimesheet}
          isSubmitting={submitMutation.isPending}
        />
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <TimesheetGrid
          weekStartDate={currentWeekStart}
          entries={timesheet?.entries ?? []}
          contracts={contracts}
          timesheetId={timesheet?.id ?? ''}
          disabled={isDisabled}
          rejectionReason={
            timesheetStatus === 'REJECTED' ? (timesheet?.rejectionReason ?? null) : null
          }
          onSave={handleSaveEntries}
        />
      )}
    </div>
  );
}

function TimesheetSyncButtons({
  connectedProviders,
  syncMutation,
  handleSync,
}: Pick<UsePortalTime, 'connectedProviders' | 'syncMutation' | 'handleSync'>) {
  if (!(connectedProviders.has('CLOCKIFY') || connectedProviders.has('JIRA'))) {
    return null;
  }
  return (
    <AnimateIn delay={3}>
      <div className="flex flex-wrap gap-3">
        {connectedProviders.has('CLOCKIFY') && (
          <ExternalSyncButton
            provider="CLOCKIFY"
            connected={true}
            onSync={handleSync('CLOCKIFY')}
            isSyncing={syncMutation.isPending && syncMutation.variables?.provider === 'CLOCKIFY'}
          />
        )}
        {connectedProviders.has('JIRA') && (
          <ExternalSyncButton
            provider="JIRA"
            connected={true}
            onSync={handleSync('JIRA')}
            isSyncing={syncMutation.isPending && syncMutation.variables?.provider === 'JIRA'}
          />
        )}
      </div>
    </AnimateIn>
  );
}

function PortalTimePageContent() {
  const t = useTranslations('Portal.timeTracking');
  const tCommon = useTranslations('Portal.login.errors');
  const {
    currentWeekStart,
    setCurrentWeekStart,
    openSingleEntry,
    historyQuery,
    currentWeekMinutes,
    pendingCount,
    approvedMonthMinutes,
    connectedProviders,
    submitMutation,
    createSingleEntryMutation,
    syncMutation,
    handleWeekChange,
    handleSubmitTimesheet,
    handleSaveEntries,
    handleSingleEntry,
    handleSync,
    singleEntryOpen,
    setSingleEntryOpen,
    isLoading,
    isError,
    timesheet,
    contracts,
    timesheetStatus,
    isDisabled,
  } = usePortalTime();

  const handleSelectWeek = useCallback(
    (weekStartDate: Date | string) => {
      const d = new Date(weekStartDate);
      setCurrentWeekStart(startOfISOWeek(d));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setCurrentWeekStart],
  );

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="mt-4 text-sm text-muted-foreground">{tCommon('somethingWentWrong')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AnimateIn delay={0}>
        <WorkbenchPageHeader
          title={t('title')}
          actions={
            isDisabled ? null : (
              <Button variant="outline" onClick={openSingleEntry} className="gap-2">
                <Plus className="h-4 w-4" />
                {t('addEntry')}
              </Button>
            )
          }
        />
      </AnimateIn>

      <AnimateIn delay={1}>
        <TimeSummaryStats
          currentWeekMinutes={currentWeekMinutes}
          pendingCount={pendingCount}
          approvedMonthMinutes={approvedMonthMinutes}
          isLoading={isLoading}
        />
      </AnimateIn>

      <AnimateIn delay={2}>
        <TimesheetWeekSection
          isLoading={isLoading}
          currentWeekStart={currentWeekStart}
          timesheetStatus={timesheetStatus}
          timesheet={timesheet}
          contracts={contracts}
          isDisabled={isDisabled}
          submitMutation={submitMutation}
          handleWeekChange={handleWeekChange}
          handleSubmitTimesheet={handleSubmitTimesheet}
          handleSaveEntries={handleSaveEntries}
        />
      </AnimateIn>

      <TimesheetSyncButtons
        connectedProviders={connectedProviders}
        syncMutation={syncMutation}
        handleSync={handleSync}
      />

      <AnimateIn delay={4}>
        <TimesheetHistorySection
          t={t}
          tCommon={tCommon}
          isPending={historyQuery.isPending}
          isError={historyQuery.isError}
          items={(historyQuery.data?.items ?? []) as TimesheetHistoryRow[]}
          onSelectWeek={handleSelectWeek}
        />
      </AnimateIn>

      <SingleEntryForm
        open={singleEntryOpen}
        onOpenChange={setSingleEntryOpen}
        contracts={contracts}
        onSubmit={handleSingleEntry}
        isSubmitting={createSingleEntryMutation.isPending}
      />
    </div>
  );
}

export default function PortalTimePage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalTimePageContent />
    </Suspense>
  );
}

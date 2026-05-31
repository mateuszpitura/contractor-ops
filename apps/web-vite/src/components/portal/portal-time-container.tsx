import { DataTable, SectionLabel, TimeTrackingIllustration } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import type { ColumnDef } from '@tanstack/react-table';
import { endOfISOWeek, format, startOfISOWeek } from 'date-fns';
import { AlertCircle, Plus } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import { AnimateIn } from '../shared/animate-in.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { ExternalSyncButton } from '../time/external-sync-button.js';
import { SingleEntryForm } from '../time/single-entry-form.js';
import { TimeEntryStatusBadge } from '../time/time-entry-status-badge.js';
import { TimeSummaryStats } from '../time/time-summary-stats.js';
import { TimesheetGrid } from '../time/timesheet-grid.js';
import { TimesheetHeader } from '../time/timesheet-header.js';
import { usePortalTime } from './hooks/use-portal-time.js';

function formatWeekRange(weekStart: Date | string): string {
  const d = typeof weekStart === 'string' ? new Date(weekStart) : weekStart;
  const weekEnd = endOfISOWeek(d);
  return `${format(d, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
}

function minutesToHoursDisplay(minutes: number): string {
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
}

interface TimesheetHistoryRow {
  id: string;
  weekStartDate: Date | string;
  totalMinutes: number;
  status: string;
  submittedAt: Date | string | null | undefined;
}

export function PortalTimeContainer() {
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
      </AnimateIn>

      {(connectedProviders.has('CLOCKIFY') || connectedProviders.has('JIRA')) && (
        <AnimateIn delay={3}>
          <div className="flex flex-wrap gap-3">
            {connectedProviders.has('CLOCKIFY') && (
              <ExternalSyncButton
                provider="CLOCKIFY"
                connected={true}
                onSync={handleSync('CLOCKIFY')}
                isSyncing={
                  syncMutation.isPending && syncMutation.variables?.provider === 'CLOCKIFY'
                }
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
      )}

      <AnimateIn delay={4}>
        <TimesheetHistorySection
          t={t}
          tCommon={tCommon}
          isPending={historyQuery.isPending}
          isError={historyQuery.isError}
          items={
            (historyQuery.data?.items ?? []) as TimesheetHistoryRow[]
          }
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
            {row.original.submittedAt
              ? format(new Date(row.original.submittedAt as unknown as string), 'MMM d, yyyy')
              : '-'}
          </span>
        ),
      },
    ],
    [t],
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
      <DataTable
        columns={columns}
        data={items}
        totalRows={items.length}
        clientPagination
        pageIndex={0}
        pageSize={items.length || 1}
        onPageChange={() => undefined}
        onPageSizeChange={() => undefined}
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
        onRowClick={row => onSelectWeek(row.weekStartDate)}
        getRowId={row => row.id}
      />
    </div>
  );
}

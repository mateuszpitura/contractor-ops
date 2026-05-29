import { AtelierTableShell, SectionLabel, TimeTrackingIllustration } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { endOfISOWeek, format, startOfISOWeek } from 'date-fns';
import { AlertCircle, Plus } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useCallback } from 'react';
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

interface TimesheetHistoryRowProps {
  weekStartDate: Date | string;
  totalMinutes: number;
  status: string;
  submittedAt: Date | string | null | undefined;
  ariaLabel: string;
  onSelectWeek: (weekStartDate: Date | string) => void;
}

function TimesheetHistoryRow({
  weekStartDate,
  totalMinutes,
  status,
  submittedAt,
  ariaLabel,
  onSelectWeek,
}: TimesheetHistoryRowProps) {
  const handleClick = useCallback(() => onSelectWeek(weekStartDate), [onSelectWeek, weekStartDate]);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTableRowElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelectWeek(weekStartDate);
      }
    },
    [onSelectWeek, weekStartDate],
  );
  return (
    <TableRow
      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}>
      <TableCell className="font-medium">{formatWeekRange(weekStartDate)}</TableCell>
      <TableCell>{minutesToHoursDisplay(totalMinutes)}</TableCell>
      <TableCell>
        <TimeEntryStatusBadge status={status as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {submittedAt ? format(new Date(submittedAt as unknown as string), 'MMM d, yyyy') : '-'}
      </TableCell>
    </TableRow>
  );
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
        <div>
          <SectionLabel variant="portal">{t('pastTimesheets')}</SectionLabel>
          {historyQuery.isPending ? (
            <AtelierTableShell isLoading constrainHeight={false}>
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={`skel-${i}`} className="h-10 w-full" />
                ))}
              </div>
            </AtelierTableShell>
          ) : historyQuery.isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="mt-3 text-sm text-muted-foreground">{tCommon('somethingWentWrong')}</p>
            </div>
          ) : !historyQuery.data?.items || historyQuery.data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-primary/70">
                <TimeTrackingIllustration className="h-24 w-24" />
              </div>
              <h3 className="mt-5 font-display text-[20px] font-semibold">
                {t('noEntriesHeading')}
              </h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t('noEntriesBody')}</p>
            </div>
          ) : (
            <AtelierTableShell isLoading={historyQuery.isPending} constrainHeight={false}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('columns.period')}</TableHead>
                    <TableHead>{t('columns.totalHours')}</TableHead>
                    <TableHead>{t('columns.status')}</TableHead>
                    <TableHead>{t('columns.submitted')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyQuery.data.items.map(ts => {
                    const weekRange = formatWeekRange(ts.weekStartDate);
                    return (
                      <TimesheetHistoryRow
                        key={ts.id}
                        weekStartDate={ts.weekStartDate}
                        totalMinutes={ts.totalMinutes}
                        status={ts.status}
                        submittedAt={ts.submittedAt as Date | string | null | undefined}
                        ariaLabel={`${t('viewTimesheet')} ${weekRange}`}
                        onSelectWeek={handleSelectWeek}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </AtelierTableShell>
          )}
        </div>
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

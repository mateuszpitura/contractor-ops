import {
  AtelierEmptyState,
  DataTable,
  QueryErrorPanel,
  SectionLabel,
  WORKBENCH_DATA_TABLE_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Tabs, TabsList, TabsTrigger } from '@contractor-ops/ui/components/shadcn/tabs';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarClock, CheckCircle2, Clock, Plus, XCircle } from 'lucide-react';
import { useCallback, useId, useMemo, useState } from 'react';

import { useLocale } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { EntityDetailItem, EntitySummarySheet } from '../table-kit/entity-summary-sheet.js';
import type { LeaveQueueRow, LeaveStatus, SickEntryInput } from './hooks/use-leave-queue.js';
import { minutesToDays, useLeaveQueue } from './hooks/use-leave-queue.js';
import { LeaveBalanceCard } from './leave-balance-card.js';

const STATUS_TABS = ['all', 'PENDING', 'APPROVED', 'REJECTED'] as const;

const STATUS_BADGE: Record<LeaveStatus, string> = {
  PENDING: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  APPROVED: 'bg-green-500/10 text-green-800 dark:text-green-400',
  REJECTED: 'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground',
};

const STATUS_ICON: Record<LeaveStatus, typeof Clock> = {
  PENDING: Clock,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  CANCELLED: XCircle,
};

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function LeaveStatusBadge({ status, label }: { status: LeaveStatus; label: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge className={`gap-1 border-0 font-normal ${STATUS_BADGE[status]}`}>
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </Badge>
  );
}

function getLeaveColumns(
  t: ReturnType<typeof useTranslations>,
  tStatus: ReturnType<typeof useTranslations>,
  locale: string,
): ColumnDef<LeaveQueueRow>[] {
  return [
    {
      id: 'worker',
      header: t('columns.worker'),
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.workerName}</span>,
    },
    {
      id: 'type',
      header: t('columns.type'),
      cell: ({ row }) => <span className="text-sm">{row.original.leaveTypeName}</span>,
    },
    {
      id: 'dates',
      header: t('columns.dates'),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {formatDate(row.original.startDate, locale)} – {formatDate(row.original.endDate, locale)}
        </span>
      ),
    },
    {
      id: 'days',
      header: () => <span className="block text-end">{t('columns.days')}</span>,
      cell: ({ row }) => (
        <span className="block text-end text-sm tabular-nums">
          {minutesToDays(row.original.requestedMinutes)}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('columns.status'),
      cell: ({ row }) => (
        <LeaveStatusBadge status={row.original.status} label={tStatus(row.original.status)} />
      ),
    },
  ];
}

interface RecordSickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeOptions: { id: string; name: string }[];
  onSubmit: (input: SickEntryInput) => void;
  isSubmitting: boolean;
}

function RecordSickDialog({
  open,
  onOpenChange,
  employeeOptions,
  onSubmit,
  isSubmitting,
}: RecordSickDialogProps) {
  const t = useTranslations('Leave.sick');
  const id = useId();
  const [workerId, setWorkerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = useCallback(() => {
    setWorkerId('');
    setStartDate('');
    setEndDate('');
    setHours('');
    setNote('');
    setErrors({});
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset],
  );

  const handleSubmit = useCallback(() => {
    const next: Record<string, string> = {};
    if (!workerId) next.workerId = t('validation.workerRequired');
    if (!startDate) next.startDate = t('validation.dateRequired');
    if (!endDate) next.endDate = t('validation.dateRequired');
    const hoursVal = Number.parseFloat(hours);
    if (!hours || Number.isNaN(hoursVal) || hoursVal < 0.25 || hoursVal > 24)
      next.hours = t('validation.hoursRange');
    if (startDate && endDate && startDate > endDate) next.endDate = t('validation.dateOrder');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    onSubmit({
      workerId,
      startDate,
      endDate,
      minutes: Math.round(hoursVal * 60),
      note: note.trim() || undefined,
    });
    reset();
  }, [workerId, startDate, endDate, hours, note, onSubmit, reset, t]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="default">
            <Plus className="h-4 w-4" />
            {t('trigger')}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-worker`}>{t('worker')}</Label>
            <Select value={workerId} onValueChange={value => setWorkerId(value ?? '')}>
              <SelectTrigger id={`${id}-worker`}>
                <SelectValue placeholder={t('workerPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {employeeOptions.map(option => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.workerId ? <p className="text-sm text-destructive">{errors.workerId}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-start`}>{t('startDate')}</Label>
              <Input
                id={`${id}-start`}
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              {errors.startDate ? (
                <p className="text-sm text-destructive">{errors.startDate}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-end`}>{t('endDate')}</Label>
              <Input
                id={`${id}-end`}
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
              {errors.endDate ? <p className="text-sm text-destructive">{errors.endDate}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-hours`}>{t('hours')}</Label>
            <Input
              id={`${id}-hours`}
              type="number"
              step="0.25"
              min="0.25"
              max="24"
              placeholder={t('hoursPlaceholder')}
              value={hours}
              onChange={e => setHours(e.target.value)}
              className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            {errors.hours ? <p className="text-sm text-destructive">{errors.hours}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-note`}>
              {t('note')}{' '}
              <span className="font-normal text-muted-foreground">{t('noteOptional')}</span>
            </Label>
            <Textarea
              id={`${id}-note`}
              rows={3}
              maxLength={1000}
              placeholder={t('notePlaceholder')}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </DialogBody>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? t('submitting') : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface LeaveQueueViewProps {
  queue: ReturnType<typeof useLeaveQueue>;
}

function LeaveQueueView({ queue }: LeaveQueueViewProps) {
  const t = useTranslations('Leave');
  const tStatus = useTranslations('Leave.status');
  const tFilters = useTranslations('Leave.filters');
  const tPanel = useTranslations('Leave.panel');
  const locale = useLocale();

  const columns = useMemo(() => getLeaveColumns(t, tStatus, locale), [t, tStatus, locale]);

  const { request } = queue.sidePanel;

  return (
    <section aria-label={t('sectionLabel')} className={WORKBENCH_TABLE_SECTION_CLASS}>
      <div className="flex items-center justify-between gap-4">
        <SectionLabel icon={CalendarClock}>{t('sectionLabel')}</SectionLabel>
        <RecordSickDialog
          open={queue.sickOpen}
          onOpenChange={queue.onSickOpenChange}
          employeeOptions={queue.employeeOptions}
          onSubmit={queue.onRecordSick}
          isSubmitting={queue.isRecordingSick}
        />
      </div>

      <Tabs value={queue.statusFilter} onValueChange={queue.onStatusChange}>
        <TabsList>
          {STATUS_TABS.map(value => (
            <TabsTrigger key={value} value={value}>
              {tFilters(value)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className={WORKBENCH_DATA_TABLE_CLASS}>
        <DataTable
          columns={columns}
          data={queue.queueProps.rows}
          totalRows={queue.queueProps.totalRows}
          entityLabel={t('entityLabel')}
          emptyTitle={t('empty.heading')}
          noResultsTitle={t('filtered.heading')}
          isLoading={queue.queueProps.isLoading}
          pageIndex={queue.queueProps.page}
          pageSize={queue.queueProps.pageSize}
          onPageChange={queue.queueProps.onPageChange}
          onPageSizeChange={queue.queueProps.onPageSizeChange}
          onRowClick={queue.queueProps.onRowClick}
          hasFiltersOrSearch={queue.hasActiveFilters}
          onClearFilters={queue.onClearFilters}
          clearFiltersLabel={t('filtered.clear')}
          getRowId={row => row.id}
        />
      </div>

      <EntitySummarySheet
        open={queue.sidePanel.open}
        onOpenChange={queue.sidePanel.onOpenChange}
        title={request ? request.workerName : tPanel('title')}
        badges={
          request ? (
            <LeaveStatusBadge status={request.status} label={tStatus(request.status)} />
          ) : null
        }
        detailsTitle={tPanel('detailsTitle')}>
        {request ? (
          <div className="space-y-6">
            <LeaveBalanceCard
              availableMinutes={queue.sidePanel.availableMinutes}
              requestedMinutes={request.requestedMinutes}
              remainingMinutes={queue.sidePanel.remainingMinutes}
              isLoading={queue.sidePanel.balanceLoading}
            />
            <div className="space-y-3">
              <EntityDetailItem label={tPanel('type')} value={request.leaveTypeName} />
              <EntityDetailItem
                label={tPanel('startDate')}
                value={formatDate(request.startDate, locale)}
              />
              <EntityDetailItem
                label={tPanel('endDate')}
                value={formatDate(request.endDate, locale)}
              />
              <EntityDetailItem
                label={tPanel('requested')}
                value={`${minutesToDays(request.requestedMinutes)} ${t('columns.days').toLowerCase()}`}
              />
            </div>
          </div>
        ) : null}
      </EntitySummarySheet>
    </section>
  );
}

export function LeaveQueue() {
  const queue = useLeaveQueue();
  const t = useTranslations('Leave');

  if (queue.isError) {
    return (
      <div className={WORKBENCH_TABLE_SECTION_CLASS}>
        <QueryErrorPanel
          message={t('error.message')}
          retryLabel={t('error.retry')}
          onRetry={queue.onRetry}
        />
      </div>
    );
  }

  if (queue.isEmpty && !queue.hasActiveFilters) {
    return (
      <section aria-label={t('sectionLabel')} className={WORKBENCH_TABLE_SECTION_CLASS}>
        <div className="flex items-center justify-end">
          <RecordSickDialog
            open={queue.sickOpen}
            onOpenChange={queue.onSickOpenChange}
            employeeOptions={queue.employeeOptions}
            onSubmit={queue.onRecordSick}
            isSubmitting={queue.isRecordingSick}
          />
        </div>
        <AtelierEmptyState
          variant="page"
          icon={CalendarClock}
          heading={t('empty.heading')}
          body={t('empty.body')}
          renderAction={renderEmptyStateAction}
        />
      </section>
    );
  }

  return <LeaveQueueView queue={queue} />;
}

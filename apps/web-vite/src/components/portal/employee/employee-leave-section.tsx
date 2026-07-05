/**
 * Employee leave section — leave balances, the caller's own leave requests, and
 * a validated time-off request dialog. The request form carries NO workerId
 * (the session is the subject); a leave type is chosen from the caller's own
 * balances. Presentational views only; the tRPC boundary is `use-employee-leave`.
 */

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
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CalendarPlus, Loader2, Plane } from 'lucide-react';
import { useCallback, useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { SectionCard, SectionMessage, SectionSkeleton } from './employee-section-shell.js';
import type {
  EmployeeLeaveRequest,
  LeaveTypeOption,
  TimeOffFormValues,
} from './hooks/use-employee-leave.js';
import { useEmployeeLeave } from './hooks/use-employee-leave.js';

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  CANCELLED: 'outline',
};

const timeOffSchema = z
  .object({
    leaveTypeId: z.string().min(1),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    hours: z.coerce.number().positive(),
    note: z.string().max(1000).optional(),
  })
  .refine(values => values.startDate <= values.endDate, { path: ['endDate'] });

type TimeOffSchema = z.input<typeof timeOffSchema>;

interface TimeOffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveTypeOptions: LeaveTypeOption[];
  onSubmit: (values: TimeOffFormValues) => void;
  isSubmitting: boolean;
}

export function TimeOffDialog({
  open,
  onOpenChange,
  leaveTypeOptions,
  onSubmit,
  isSubmitting,
}: TimeOffDialogProps) {
  const t = useTranslations('Portal.employee.leave.form');
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<TimeOffSchema>({
    resolver: zodResolver(timeOffSchema),
    defaultValues: { leaveTypeId: '', startDate: '', endDate: '', note: '' },
  });

  const selectedLeaveType = watch('leaveTypeId');

  const fieldId = useId();
  const ids = {
    leaveType: `${fieldId}-leave-type`,
    startDate: `${fieldId}-start-date`,
    endDate: `${fieldId}-end-date`,
    hours: `${fieldId}-hours`,
    note: `${fieldId}-note`,
  };

  const submit = handleSubmit(values => {
    onSubmit({
      leaveTypeId: values.leaveTypeId,
      startDate: values.startDate,
      endDate: values.endDate,
      requestedMinutes: Math.round(Number(values.hours) * 60),
      note: values.note?.trim() ? values.note.trim() : undefined,
    });
  });

  const handleDialogChange = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [reset, onOpenChange],
  );

  const handleLeaveTypeChange = useCallback(
    (value: string | null) => setValue('leaveTypeId', value ?? '', { shouldValidate: true }),
    [setValue],
  );

  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="size-4" aria-hidden="true" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={ids.leaveType}>{t('leaveType')}</Label>
              <Select value={selectedLeaveType} onValueChange={handleLeaveTypeChange}>
                <SelectTrigger id={ids.leaveType} aria-invalid={!!errors.leaveTypeId}>
                  <SelectValue placeholder={t('leaveTypePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypeOptions.map(option => (
                    <SelectItem key={option.leaveTypeId} value={option.leaveTypeId}>
                      {t('leaveTypeOption', { available: formatHours(option.availableMinutes) })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!!errors.leaveTypeId && (
                <p className="text-xs text-destructive">{t('leaveTypeRequired')}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={ids.startDate}>{t('startDate')}</Label>
                <Input id={ids.startDate} type="date" {...register('startDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={ids.endDate}>{t('endDate')}</Label>
                <Input
                  id={ids.endDate}
                  type="date"
                  aria-invalid={!!errors.endDate}
                  {...register('endDate')}
                />
                {errors.endDate?.type === 'custom' && (
                  <p className="text-xs text-destructive">{t('endAfterStart')}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={ids.hours}>{t('hours')}</Label>
              <Input
                id={ids.hours}
                type="number"
                min="0.5"
                step="0.5"
                aria-invalid={!!errors.hours}
                {...register('hours')}
              />
              {!!errors.hours && <p className="text-xs text-destructive">{t('hoursRequired')}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={ids.note}>{t('note')}</Label>
              <Textarea
                id={ids.note}
                rows={2}
                placeholder={t('notePlaceholder')}
                {...register('note')}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {!!isSubmitting && (
                <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EmployeeLeaveSectionViewProps {
  balances: {
    leaveTypeId: string;
    entitledMinutes: number;
    usedMinutes: number;
    carryoverMinutes: number;
  }[];
  requests: EmployeeLeaveRequest[];
  canRequest: boolean;
  onRequestClick: () => void;
}

export function EmployeeLeaveSectionView({
  balances,
  requests,
  canRequest,
  onRequestClick,
}: EmployeeLeaveSectionViewProps) {
  const t = useTranslations('Portal.employee.leave');

  return (
    <SectionCard
      icon={Plane}
      title={t('title')}
      description={t('description')}
      actions={
        <Button size="sm" onClick={onRequestClick} disabled={!canRequest}>
          <CalendarPlus className="me-2 h-4 w-4" aria-hidden="true" />
          {t('requestButton')}
        </Button>
      }>
      <div className="space-y-5">
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">{t('balancesHeading')}</h3>
          {balances.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noBalances')}</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {balances.map(balance => (
                <li
                  key={balance.leaveTypeId}
                  className="flex items-baseline justify-between rounded-lg border bg-card px-3 py-2">
                  <span className="text-sm text-muted-foreground">{t('available')}</span>
                  <span className="font-display text-lg font-semibold">
                    {formatHours(
                      balance.entitledMinutes + balance.carryoverMinutes - balance.usedMinutes,
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">{t('requestsHeading')}</h3>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noRequests')}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {requests.map(request => (
                <li
                  key={request.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {new Date(request.startDate).toLocaleDateString()} –{' '}
                      {new Date(request.endDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatHours(request.requestedMinutes)}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[request.status] ?? 'secondary'}>
                    {t(`status.${request.status}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

export function EmployeeLeaveSection() {
  const t = useTranslations('Portal.employee.leave');
  const leave = useEmployeeLeave();

  if (leave.isLoading) return <SectionSkeleton rows={4} />;
  if (leave.isUnavailable) {
    return (
      <SectionCard icon={Plane} title={t('title')}>
        <SectionMessage icon={Plane} title={t('unavailableTitle')} description={t('unavailable')} />
      </SectionCard>
    );
  }
  if (leave.isError) {
    return (
      <SectionCard icon={Plane} title={t('title')}>
        <SectionMessage
          icon={AlertCircle}
          tone="danger"
          title={t('errorTitle')}
          description={t('error')}
        />
      </SectionCard>
    );
  }

  return (
    <>
      <EmployeeLeaveSectionView
        balances={leave.balances}
        requests={leave.requests}
        canRequest={leave.canRequest}
        onRequestClick={() => leave.setDialogOpen(true)}
      />
      <TimeOffDialog
        open={leave.dialogOpen}
        onOpenChange={leave.setDialogOpen}
        leaveTypeOptions={leave.leaveTypeOptions}
        onSubmit={leave.submit}
        isSubmitting={leave.isSubmitting}
      />
    </>
  );
}

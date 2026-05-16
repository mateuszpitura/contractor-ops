'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { TimePicker } from '@/components/ui/time-picker';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc/init';

const DEFAULT_FROM_TIME = '09:00';
const DEFAULT_UNTIL_TIME = '17:00';

/** Combine a local Date (only y/m/d parts read) with a `HH:mm` string into a Date. */
function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return result;
}

/**
 * "Out of office" section in user settings.
 * Wires user.setOutOfOffice / user.clearOutOfOffice.
 *
 * Uses the project's `<Calendar>` popover for range selection plus our
 * `<TimePicker>` design-system component for the from/until time inputs.
 */
export function OutOfOfficeSection() {
  const t = useTranslations('Settings.outOfOffice');
  const queryClient = useQueryClient();

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [fromTime, setFromTime] = useState(DEFAULT_FROM_TIME);
  const [untilTime, setUntilTime] = useState(DEFAULT_UNTIL_TIME);
  const [reason, setReason] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);

  const setOoo = useMutation(
    trpc.user.setOutOfOffice.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.saved'));
        queryClient.invalidateQueries(trpc.user.pathFilter());
        setDateRange(undefined);
        setFromTime(DEFAULT_FROM_TIME);
        setUntilTime(DEFAULT_UNTIL_TIME);
        setReason('');
      },
      onError: err => toast.error(err.message),
    }),
  );
  const clearOoo = useMutation(
    trpc.user.clearOutOfOffice.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.cleared'));
        queryClient.invalidateQueries(trpc.user.pathFilter());
      },
      onError: err => toast.error(err.message),
    }),
  );

  const isPending = setOoo.isPending || clearOoo.isPending;

  // Final ISO timestamps assembled from the picked date + time. Computed once
  // per render — used both for validation and submission.
  const { fromIso, untilIso, isValid } = useMemo(() => {
    if (!(dateRange?.from && dateRange.to)) {
      return { fromIso: null, untilIso: null, isValid: false };
    }
    const fromDt = combineDateAndTime(dateRange.from, fromTime);
    const untilDt = combineDateAndTime(dateRange.to, untilTime);
    return {
      fromIso: fromDt.toISOString(),
      untilIso: untilDt.toISOString(),
      isValid: untilDt.getTime() >= fromDt.getTime(),
    };
  }, [dateRange, fromTime, untilTime]);

  const triggerLabel = useMemo(() => {
    if (dateRange?.from && dateRange.to) {
      return `${format(dateRange.from, 'MMM d, yyyy')} – ${format(dateRange.to, 'MMM d, yyyy')}`;
    }
    if (dateRange?.from) return format(dateRange.from, 'MMM d, yyyy');
    return null;
  }, [dateRange]);

  function handleSave() {
    if (!(isValid && fromIso && untilIso)) return;
    setOoo.mutate({
      from: fromIso,
      until: untilIso,
      reason: reason || undefined,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ooo-range">{t('rangePickerLabel')}</Label>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={props => (
                <Button
                  {...props}
                  id="ooo-range"
                  variant="outline"
                  disabled={isPending}
                  className={cn(
                    'w-full justify-start gap-2 font-normal',
                    !triggerLabel && 'text-muted-foreground',
                  )}>
                  <CalendarIcon className="h-4 w-4" />
                  <span>{triggerLabel ?? t('rangePickerPlaceholder')}</span>
                </Button>
              )}
            />
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                numberOfMonths={2}
                selected={dateRange}
                onSelect={setDateRange}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="ooo-from-time">{t('fromTime')}</Label>
            <TimePicker
              aria-label={t('fromTime')}
              value={fromTime}
              onChange={setFromTime}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ooo-until-time">{t('untilTime')}</Label>
            <TimePicker
              aria-label={t('untilTime')}
              value={untilTime}
              onChange={setUntilTime}
              disabled={isPending}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ooo-reason">{t('reason')}</Label>
          <Textarea
            id="ooo-reason"
            rows={2}
            value={reason}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => setReason(e.target.value)}
            disabled={isPending}
            maxLength={500}
            placeholder={t('reasonPlaceholder')}
          />
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button
          variant="outline"
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => clearOoo.mutate()}
          disabled={isPending}>
          {clearOoo.isPending && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
          {t('clearCta')}
        </Button>
        <Button onClick={handleSave} disabled={!isValid || isPending}>
          {setOoo.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          {t('saveCta')}
        </Button>
      </CardFooter>
    </Card>
  );
}

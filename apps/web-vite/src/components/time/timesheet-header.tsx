/**
 * Timesheet header bar (week selector + status + submit). Ported from
 * apps/web/src/components/time/timesheet-header.tsx:
 *   - next-intl → ../../i18n/useTranslations.js
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Calendar } from '@contractor-ops/ui/components/shadcn/calendar';
import { formControlPopoverRender } from '@contractor-ops/ui/components/shadcn/form-control-trigger';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { addWeeks, endOfISOWeek, format, startOfISOWeek, subWeeks } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { TimeEntryStatusBadge } from './time-entry-status-badge.js';

interface TimesheetHeaderProps {
  weekStartDate: Date;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  totalMinutes: number;
  onWeekChange: (date: Date) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function TimesheetHeader({
  weekStartDate,
  status,
  totalMinutes,
  onWeekChange,
  onSubmit,
  isSubmitting,
}: TimesheetHeaderProps) {
  const t = useTranslations('Time');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const weekEnd = endOfISOWeek(weekStartDate);
  const weekLabel = `${format(weekStartDate, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
  const totalHours = totalMinutes / 60;
  const displayHours = totalHours % 1 === 0 ? totalHours.toFixed(0) : totalHours.toFixed(1);

  const canSubmit = totalMinutes > 0 && (status === 'DRAFT' || status === 'REJECTED');

  const handlePrevWeek = useCallback(() => {
    onWeekChange(subWeeks(weekStartDate, 1));
  }, [onWeekChange, weekStartDate]);

  const handleNextWeek = useCallback(() => {
    onWeekChange(addWeeks(weekStartDate, 1));
  }, [onWeekChange, weekStartDate]);

  const handleCalendarSelect = useCallback(
    (date: Date | undefined) => {
      if (date) {
        onWeekChange(startOfISOWeek(date));
        setCalendarOpen(false);
      }
    },
    [onWeekChange],
  );

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevWeek}
          aria-label={t('header.prevWeek')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger render={formControlPopoverRender('gap-2')}>
            <CalendarDays className="h-4 w-4" />
            {weekLabel}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={weekStartDate}
              onSelect={handleCalendarSelect}
              defaultMonth={weekStartDate}
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextWeek}
          aria-label={t('header.nextWeek')}>
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="ms-2">
          <TimeEntryStatusBadge status={status} />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-end">
          <span className="text-[28px] font-semibold leading-[1.2] text-primary">
            {displayHours}h
          </span>
        </div>
        <Button onClick={onSubmit} disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? t('header.submitting') : t('header.submitTimesheet')}
        </Button>
      </div>
    </div>
  );
}

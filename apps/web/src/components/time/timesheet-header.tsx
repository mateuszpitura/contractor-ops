'use client';

import { addWeeks, endOfISOWeek, format, startOfISOWeek, subWeeks } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TimeEntryStatusBadge } from './time-entry-status-badge';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TimesheetHeaderProps {
  weekStartDate: Date;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  totalMinutes: number;
  onWeekChange: (date: Date) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Header bar above the timesheet grid per UI-SPEC TimesheetHeader.
 *
 * Left: Week selector with chevron buttons and popover calendar.
 * Center: TimeEntryStatusBadge for current timesheet status.
 * Right: Total hours display (accent color, display typography) + Submit button.
 */
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

  const handlePrevWeek = () => {
    onWeekChange(subWeeks(weekStartDate, 1));
  };

  const handleNextWeek = () => {
    onWeekChange(addWeeks(weekStartDate, 1));
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      onWeekChange(startOfISOWeek(date));
      setCalendarOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: Week selector */}
      <div className="flex items-center gap-2">
        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevWeek}
          aria-label={t('header.prevWeek')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger render={<Button variant="outline" className="gap-2 font-normal" />}>
            <CalendarDays className="h-4 w-4" />
            {weekLabel}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={weekStartDate}
              // biome-ignore lint/nursery/noJsxPropsBind: menu item handler
              onSelect={handleCalendarSelect}
              defaultMonth={weekStartDate}
            />
          </PopoverContent>
        </Popover>

        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextWeek}
          aria-label={t('header.nextWeek')}>
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Center: Status badge */}
        <div className="ms-2">
          <TimeEntryStatusBadge status={status} />
        </div>
      </div>

      {/* Right: Total + Submit */}
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

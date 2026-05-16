'use client';

import { format as formatDate } from 'date-fns';
import { CalendarRange } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TimePicker } from '@/components/ui/time-picker';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DateTimeRange {
  /** Start of the window. */
  from: Date;
  /** End of the window (inclusive). */
  until: Date;
}

export interface DateTimeRangePickerLabels {
  /** Trigger placeholder when no range is selected. */
  placeholder?: string;
  fromTime?: string;
  untilTime?: string;
  apply?: string;
  clear?: string;
}

export interface DateTimeRangePickerProps {
  value: DateTimeRange | undefined;
  onChange: (next: DateTimeRange | undefined) => void;
  timeFormat?: '24h' | '12h';
  /** Minute granularity for the embedded `<TimePicker>` columns. */
  timeStep?: number;
  /** Default `HH:mm` (24h) applied when only dates are picked. */
  defaultFromTime?: string;
  defaultUntilTime?: string;
  disabled?: boolean;
  className?: string;
  labels?: DateTimeRangePickerLabels;
  'aria-label'?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_LABELS: Required<DateTimeRangePickerLabels> = {
  placeholder: 'Pick a date & time range',
  fromTime: 'From time',
  untilTime: 'Until time',
  apply: 'Apply',
  clear: 'Clear',
};

const DEFAULT_FROM_TIME = '09:00';
const DEFAULT_UNTIL_TIME = '17:00';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function timeToHM(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function dateAtTime(date: Date, time: string): Date {
  const { h, m } = timeToHM(time);
  const next = new Date(date);
  next.setHours(h, m, 0, 0);
  return next;
}

function formatDateLabel(d: Date): string {
  return formatDate(d, 'MMM d, yyyy');
}

function formatTimeLabel(d: Date, mode: '24h' | '12h'): string {
  if (mode === '12h') {
    const hours = d.getHours();
    const mins = d.getMinutes();
    const period = hours < 12 ? 'AM' : 'PM';
    const mod = hours % 12;
    const hour12 = mod === 0 ? 12 : mod;
    return `${pad2(hour12)}:${pad2(mins)} ${period}`;
  }
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function dateToHM(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DateTimeRangePicker — single popover combining:
 *  - A range `<Calendar>` (two months side-by-side).
 *  - Two `<TimePicker>` inputs for from/until time.
 *  - Apply / Clear actions.
 *
 * Committing is deferred to "Apply" so the user can adjust both endpoints
 * before propagation. The popover's draft state is rebuilt from `value`
 * each time it opens, so external mutations stay in sync.
 *
 * Usage:
 *   <DateTimeRangePicker
 *     value={range}
 *     onChange={setRange}
 *     timeFormat="24h"
 *     labels={{ placeholder, fromTime, untilTime, apply, clear }}
 *   />
 *
 *   - `value` / `onChange` use absolute `Date` objects (`from` / `until`).
 *   - `timeStep` controls the minute granularity inside the embedded
 *     `<TimePicker>` columns (defaults to 5).
 *
 *   IMPORTANT — popover-trigger parent containers MUST use
 *   `flex flex-col gap-*`, NOT Tailwind's `space-y-*`. Base UI's
 *   `Popover.Trigger` injects two `position: fixed` `<FocusGuard>` spans
 *   next to the trigger button when the popover opens, which shifts
 *   `:last-child` resolution and causes `space-y-*` to bump the
 *   trigger's `margin-block-end`, producing a visible layout jump.
 *
 *   ❌  <div className="space-y-2"><Label/><DateTimeRangePicker/></div>
 *   ✅  <div className="flex flex-col gap-2"><Label/><DateTimeRangePicker/></div>
 */
export function DateTimeRangePicker({
  value,
  onChange,
  timeFormat = '24h',
  timeStep = 5,
  defaultFromTime = DEFAULT_FROM_TIME,
  defaultUntilTime = DEFAULT_UNTIL_TIME,
  disabled,
  className,
  labels: labelOverrides,
  'aria-label': ariaLabel,
}: DateTimeRangePickerProps) {
  const id = useId();
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };

  const [open, setOpen] = useState(false);

  // ── Draft state ────────────────────────────────────────────────────────
  // Lives only while the popover is open. Reset from `value` every time we
  // open so external edits propagate in cleanly.
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [fromTime, setFromTime] = useState(defaultFromTime);
  const [untilTime, setUntilTime] = useState(defaultUntilTime);

  // Rebuild the draft when the popover opens or the external value changes.
  useEffect(() => {
    if (!open) return;
    if (value) {
      setDateRange({ from: value.from, to: value.until });
      setFromTime(dateToHM(value.from));
      setUntilTime(dateToHM(value.until));
    } else {
      setDateRange(undefined);
      setFromTime(defaultFromTime);
      setUntilTime(defaultUntilTime);
    }
  }, [open, value, defaultFromTime, defaultUntilTime]);

  const handleApply = useCallback(() => {
    if (!(dateRange?.from && dateRange.to)) return;
    const fromDt = dateAtTime(dateRange.from, fromTime);
    const untilDt = dateAtTime(dateRange.to, untilTime);
    if (untilDt.getTime() < fromDt.getTime()) return; // Apply button is disabled in this state, defensive only.
    onChange({ from: fromDt, until: untilDt });
    setOpen(false);
  }, [dateRange, fromTime, untilTime, onChange]);

  const handleClear = useCallback(() => {
    onChange(undefined);
    setOpen(false);
  }, [onChange]);

  // ── Trigger label ──────────────────────────────────────────────────────
  const triggerLabel = useMemo(() => {
    if (!value) return null;
    const datePart = `${formatDateLabel(value.from)} – ${formatDateLabel(value.until)}`;
    const timePart = `${formatTimeLabel(value.from, timeFormat)} → ${formatTimeLabel(value.until, timeFormat)}`;
    return `${datePart} · ${timePart}`;
  }, [value, timeFormat]);

  // ── Draft validity ─────────────────────────────────────────────────────
  const isDraftValid = useMemo(() => {
    if (!(dateRange?.from && dateRange.to)) return false;
    const fromDt = dateAtTime(dateRange.from, fromTime);
    const untilDt = dateAtTime(dateRange.to, untilTime);
    return untilDt.getTime() >= fromDt.getTime();
  }, [dateRange, fromTime, untilTime]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
        render={props => (
          <Button
            {...props}
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-label={ariaLabel ?? 'Pick a date & time range'}
            className={cn(
              'w-full justify-start gap-2 font-normal',
              !triggerLabel && 'text-muted-foreground',
              className,
            )}>
            <CalendarRange aria-hidden="true" className="size-4 text-muted-foreground" />
            <span className="truncate">{triggerLabel ?? labels.placeholder}</span>
          </Button>
        )}
      />
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex flex-col">
          {/* Calendar */}
          <div className="px-1 pt-1">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={dateRange}
              onSelect={setDateRange}
            />
          </div>

          {/* Time row */}
          <div className="grid grid-cols-2 gap-3 border-t border-border/60 px-3 py-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${id}-from-time`}
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {labels.fromTime}
              </label>
              <TimePicker
                aria-label={labels.fromTime}
                value={fromTime}
                onChange={setFromTime}
                format={timeFormat}
                step={timeStep}
                disabled={disabled}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${id}-until-time`}
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {labels.untilTime}
              </label>
              <TimePicker
                aria-label={labels.untilTime}
                value={untilTime}
                onChange={setUntilTime}
                format={timeFormat}
                step={timeStep}
                disabled={disabled}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-border/60 px-3 py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={disabled}>
              {labels.clear}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              disabled={disabled || !isDraftValid}>
              {labels.apply}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

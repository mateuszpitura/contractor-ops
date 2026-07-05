import { addDays, eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from 'date-fns';
import { useCallback, useRef, useState } from 'react';

import { useDirection } from '../../../hooks/use-direction.js';
import { useLocale } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { CalendarDay } from '../hooks/use-team-calendar.js';
import { CapacityCell } from './capacity-cell.js';

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const ARROW_ROW: Record<string, number> = { ArrowUp: -7, ArrowDown: 7 };

interface CalendarMonthGridProps {
  monthDate: Date;
  dayMap: Map<string, CalendarDay>;
}

function emptyDay(date: string): CalendarDay {
  return { date, outCount: 0, capacityPct: 0, conflict: false, holiday: null, requests: [] };
}

/**
 * A single month as a Monday-start 7-column grid. Cells are arrow-key navigable
 * (RTL-aware); the grid inherits document direction so week order mirrors under
 * `dir="rtl"`.
 */
export function CalendarMonthGrid({ monthDate, dayMap }: CalendarMonthGridProps) {
  const t = useTranslations('Leave.calendar');
  const locale = useLocale();
  const direction = useDirection();
  const gridRef = useRef<HTMLDivElement>(null);

  const first = startOfMonth(monthDate);
  const monthDays = eachDayOfInterval({ start: first, end: endOfMonth(monthDate) });
  const leadingBlanks = (getDay(first) + 6) % 7;
  const firstDateStr = format(first, 'yyyy-MM-dd');
  const [focusedDate, setFocusedDate] = useState<string>(firstDateStr);

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(first);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const el = event.target as HTMLElement;
      const date = el.getAttribute('data-date');
      if (!date) return;

      let delta = ARROW_ROW[event.key] ?? 0;
      if (event.key === 'ArrowRight') delta = direction === 'rtl' ? -1 : 1;
      if (event.key === 'ArrowLeft') delta = direction === 'rtl' ? 1 : -1;
      if (delta === 0) return;

      const targetStr = format(addDays(new Date(date), delta), 'yyyy-MM-dd');
      const target = gridRef.current?.querySelector<HTMLButtonElement>(
        `[data-date="${targetStr}"]`,
      );
      if (target) {
        event.preventDefault();
        setFocusedDate(targetStr);
        target.focus();
      }
    },
    [direction],
  );

  return (
    <div className="space-y-2">
      <p className="text-[12px] uppercase tracking-wide text-muted-foreground">{monthLabel}</p>
      <div
        ref={gridRef}
        role="grid"
        aria-label={monthLabel}
        className="grid grid-cols-7 gap-1"
        onKeyDown={handleKeyDown}>
        {WEEKDAY_KEYS.map(key => (
          <div
            key={key}
            role="columnheader"
            className="pb-1 text-center text-[12px] text-muted-foreground">
            {t(`weekdays.${key}`)}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed leading padding cells have no stable id
          <div key={`blank-${index}`} aria-hidden />
        ))}
        {monthDays.map(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const day = dayMap.get(dateStr) ?? emptyDay(dateStr);
          const weekday = getDay(date);
          return (
            <div role="gridcell" key={dateStr}>
              <CapacityCell
                day={day}
                isWeekend={weekday === 0 || weekday === 6}
                tabIndex={dateStr === focusedDate ? 0 : -1}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

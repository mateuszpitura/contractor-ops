import { addMonths, startOfMonth } from 'date-fns';
import { useMemo } from 'react';

import type { CalendarDay, CalendarViewMode } from '../hooks/use-team-calendar.js';
import { CalendarMonthGrid } from './calendar-month-grid.js';
import { CapacityLegend } from './capacity-legend.js';

interface TeamCalendarViewProps {
  viewMode: CalendarViewMode;
  days: CalendarDay[];
  anchorDate: string;
}

/**
 * Presentational team calendar. Month view renders a single month grid; quarter
 * view stacks three consecutive month grids. Capacity + conflict come entirely
 * from props — the wired section owns fetching and state.
 */
export function TeamCalendarView({ viewMode, days, anchorDate }: TeamCalendarViewProps) {
  const dayMap = useMemo(() => new Map(days.map(day => [day.date, day])), [days]);
  const anchor = useMemo(() => startOfMonth(new Date(anchorDate)), [anchorDate]);
  const offsets = viewMode === 'quarter' ? [0, 1, 2] : [0];

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {offsets.map(offset => (
          <CalendarMonthGrid key={offset} monthDate={addMonths(anchor, offset)} dayMap={dayMap} />
        ))}
      </div>
      <CapacityLegend />
    </div>
  );
}

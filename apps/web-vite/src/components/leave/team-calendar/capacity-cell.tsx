import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';
import type { CalendarDay } from '../hooks/use-team-calendar.js';
import { ConflictMarker } from './conflict-marker.js';

interface CapacityCellProps {
  day: CalendarDay;
  isWeekend: boolean;
  tabIndex: number;
}

function bandToken(
  capacityPct: number,
  conflict: boolean,
): { token: string; strength: string } | null {
  if (conflict || capacityPct >= 75) return { token: '--status-danger', strength: '20%' };
  if (capacityPct > 0) return { token: '--status-warning', strength: '16%' };
  return null;
}

/**
 * A single day in the team calendar. Meets the 44px pointer-target size, carries
 * the capacity band tint (reusing the proportion-bar color-mix idiom), and
 * exposes date + capacity + count through its `aria-label`. Focusable for
 * arrow-key navigation owned by the grid.
 */
export function CapacityCell({ day, isWeekend, tabIndex }: CapacityCellProps) {
  const t = useTranslations('Leave.calendar');
  const dayNumber = Number(day.date.slice(8, 10));
  const band = bandToken(day.capacityPct, day.conflict);
  const bandStyle = band
    ? { backgroundColor: `color-mix(in oklch, var(${band.token}) ${band.strength}, transparent)` }
    : undefined;

  return (
    <button
      type="button"
      data-date={day.date}
      tabIndex={tabIndex}
      aria-label={t('cellLabel', {
        date: day.date,
        percent: day.capacityPct,
        count: day.outCount,
      })}
      // biome-ignore lint/nursery/noInlineStyles: capacity band fill is the runtime status tint — no static Tailwind class for the dynamic color-mix
      style={bandStyle}
      className={cn(
        'relative flex min-h-[44px] w-full flex-col items-start gap-0.5 rounded-md border border-border/50 p-1.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        (isWeekend || day.holiday) && !bandStyle && 'bg-muted',
      )}>
      <span className="flex w-full items-center justify-between">
        <span className="text-[12px] tabular-nums text-muted-foreground">{dayNumber}</span>
        {day.conflict ? <ConflictMarker count={day.outCount} teamName={day.teamName} /> : null}
      </span>
      {day.outCount > 0 ? (
        <span className="text-[12px] tabular-nums text-foreground">
          {t('capacity', { percent: day.capacityPct })}
        </span>
      ) : null}
      {day.holiday ? (
        <span
          title={day.holiday.name}
          className="mt-auto inline-flex items-center gap-1 text-[12px] text-muted-foreground">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
          <span className="truncate">{day.holiday.name}</span>
        </span>
      ) : null}
    </button>
  );
}

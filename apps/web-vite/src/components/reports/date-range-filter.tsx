import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Calendar } from '@contractor-ops/ui/components/shadcn/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { format, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { tKey } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { cn } from '../../lib/utils.js';

type Preset = 'this-month' | 'last-3m' | 'last-6m' | 'ytd' | 'custom';

const PRESETS: Array<{ id: Preset; labelKey: string }> = [
  { id: 'this-month', labelKey: 'thisMonth' },
  { id: 'last-3m', labelKey: 'last3Months' },
  { id: 'last-6m', labelKey: 'last6Months' },
  { id: 'ytd', labelKey: 'yearToDate' },
  { id: 'custom', labelKey: 'custom' },
];

function computeDateRange(preset: Exclude<Preset, 'custom'>): {
  from: string;
  to: string;
} {
  const now = new Date();
  const to = now.toISOString();

  switch (preset) {
    case 'this-month':
      return { from: startOfMonth(now).toISOString(), to };
    case 'last-3m':
      return { from: subMonths(startOfMonth(now), 3).toISOString(), to };
    case 'last-6m':
      return { from: subMonths(startOfMonth(now), 6).toISOString(), to };
    case 'ytd':
      return { from: startOfYear(now).toISOString(), to };
  }
}

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
}

export function DateRangeFilter({ dateFrom, dateTo, onDateChange }: DateRangeFilterProps) {
  const t = useTranslations('Reports');
  const [activePreset, setActivePreset] = useState<Preset>('last-3m');
  const [popoverOpen, setPopoverOpen] = useState(false);

  const calendarRange = useMemo<DateRange>(
    () => ({
      from: dateFrom ? new Date(dateFrom) : undefined,
      to: dateTo ? new Date(dateTo) : undefined,
    }),
    [dateFrom, dateTo],
  );

  const handlePresetClick = useCallback(
    (preset: Preset) => {
      setActivePreset(preset);

      if (preset === 'custom') {
        setPopoverOpen(true);
        return;
      }

      const range = computeDateRange(preset);
      onDateChange(range.from, range.to);
    },
    [onDateChange],
  );

  const handleRangeSelect = useCallback(
    (range: DateRange | undefined) => {
      if (range?.from && range?.to) {
        const [start, end] =
          range.from <= range.to ? [range.from, range.to] : [range.to, range.from];
        onDateChange(start.toISOString(), end.toISOString());
        setPopoverOpen(false);
      }
    },
    [onDateChange],
  );

  const formatDisplay = useCallback(() => {
    if (!(dateFrom && dateTo)) return '';
    return `${format(new Date(dateFrom), 'MMM d, yyyy')} - ${format(new Date(dateTo), 'MMM d, yyyy')}`;
  }, [dateFrom, dateTo]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(preset => (
        <PresetButton
          key={preset.id}
          preset={preset}
          activePreset={activePreset}
          popoverOpen={popoverOpen}
          setPopoverOpen={setPopoverOpen}
          onPresetClick={handlePresetClick}
          calendarRange={calendarRange}
          onRangeSelect={handleRangeSelect}
          formatDisplay={formatDisplay}
          labelText={tKey(t, preset.labelKey)}
        />
      ))}
    </div>
  );
}

interface PresetButtonProps {
  preset: { id: Preset; labelKey: string };
  activePreset: Preset;
  popoverOpen: boolean;
  setPopoverOpen: (open: boolean) => void;
  onPresetClick: (preset: Preset) => void;
  calendarRange: DateRange;
  onRangeSelect: (range: DateRange | undefined) => void;
  formatDisplay: () => string;
  labelText: string;
}

function PresetButton({
  preset,
  activePreset,
  popoverOpen,
  setPopoverOpen,
  onPresetClick,
  calendarRange,
  onRangeSelect,
  formatDisplay,
  labelText,
}: PresetButtonProps) {
  const handleClick = useCallback(() => onPresetClick(preset.id), [onPresetClick, preset.id]);
  const renderTrigger = useCallback(
    (props: React.HTMLAttributes<HTMLSpanElement>) => (
      <span {...props} className="flex items-center gap-1.5">
        <CalendarIcon className="h-3.5 w-3.5" />
        {activePreset === 'custom' && formatDisplay() ? <>{formatDisplay()}</> : <>{labelText}</>}
      </span>
    ),
    [activePreset, formatDisplay, labelText],
  );

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={cn(
        'h-8 text-sm',
        activePreset === preset.id
          ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
          : 'text-muted-foreground',
      )}>
      {preset.id === 'custom' ? (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger nativeButton={false} render={renderTrigger} />
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={calendarRange}
              onSelect={onRangeSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      ) : (
        labelText
      )}
    </Button>
  );
}

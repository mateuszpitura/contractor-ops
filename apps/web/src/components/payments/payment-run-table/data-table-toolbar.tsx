'use client';

import { CalendarIcon, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useId, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDateFormatter } from '@/lib/format/use-date-formatter';
import { tDyn } from '@/i18n/typed-keys';

// ---------------------------------------------------------------------------
// Status filter options
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: 'DRAFT', labelKey: 'filters.draft' },
  { value: 'LOCKED', labelKey: 'filters.locked' },
  { value: 'EXPORTED', labelKey: 'filters.exported' },
  { value: 'COMPLETED', labelKey: 'filters.completed' },
  { value: 'CANCELLED', labelKey: 'filters.cancelled' },
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DataTableToolbarProps {
  activeStatuses: string[];
  onStatusChange: (statuses: string[]) => void;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
  /** Dates that have payment run activity — shown as dots on the calendar. */
  activityDates?: Date[];
  /** Disables all interactive elements during data load */
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataTableToolbar({
  activeStatuses,
  onStatusChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  activityDates,
  isLoading,
}: DataTableToolbarProps) {
  const t = useTranslations('Payments');
  const tAria = useTranslations('Common.aria');
  const { formatDate } = useDateFormatter();
  const reactId = useId();

  const handleRangeSelect = useCallback(
    (range: { from?: Date; to?: Date } | undefined, triggerDate: Date) => {
      if (!range) {
        onDateFromChange(undefined);
        onDateToChange(undefined);
        return;
      }

      // When both dates were set and the library restarted selection (from only,
      // no to), adjust the nearest boundary instead of resetting the range.
      if (dateFrom && dateTo && range.from && !range.to) {
        const clicked = triggerDate.getTime();
        const fromTime = dateFrom.getTime();
        const toTime = dateTo.getTime();

        if (clicked <= fromTime) {
          onDateFromChange(triggerDate);
        } else if (clicked >= toTime) {
          onDateToChange(triggerDate);
        } else {
          // Between start and end — move the closer boundary
          const distToFrom = clicked - fromTime;
          const distToTo = toTime - clicked;
          if (distToFrom <= distToTo) {
            onDateFromChange(triggerDate);
          } else {
            onDateToChange(triggerDate);
          }
        }
        return;
      }

      // Normal selection flow (first click sets from, second sets to)
      onDateFromChange(range.from);
      onDateToChange(range.to);
    },
    [dateFrom, dateTo, onDateFromChange, onDateToChange],
  );

  const dateLabel = useMemo(() => {
    if (dateFrom && dateTo) {
      return `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
    }
    if (dateFrom) return t('filters.dateFrom', { date: formatDate(dateFrom) });
    if (dateTo) return t('filters.dateTo', { date: formatDate(dateTo) });
    return t('filters.dateRange');
  }, [dateFrom, dateTo, formatDate, t]);

  const toggleFilter = (value: string) => {
    if (activeStatuses.includes(value)) {
      onStatusChange(activeStatuses.filter(s => s !== value));
    } else {
      onStatusChange([...activeStatuses, value]);
    }
  };

  const removeFilter = (value: string) => {
    onStatusChange(activeStatuses.filter(s => s !== value));
  };

  const clearAllFilters = () => {
    onStatusChange([]);
  };

  const activeFilterCount = activeStatuses.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status filter — standalone select */}
        <Popover>
          <PopoverTrigger
            // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
            render={props => (
              <Button
                {...props}
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                disabled={isLoading}>
                {t('filters.status')}
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            )}
          />
          <PopoverContent className="w-52 p-0" align="start">
            <div className="p-4 space-y-2">
              <h4 className="text-[13px] font-medium text-foreground">{t('filters.status')}</h4>
              <div className="space-y-1">
                {STATUS_OPTIONS.map(option => (
                  <label
                    key={option.value}
                    htmlFor={`${reactId}-filter-${option.value}`}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
                    <Checkbox
                      id={`${reactId}-filter-${option.value}`}
                      checked={activeStatuses.includes(option.value)}
                      // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                      onCheckedChange={() => toggleFilter(option.value)}
                    />
                    <span>{t(option.labelKey)}</span>
                  </label>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Date range filter */}
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={isLoading} />
            }>
            <CalendarIcon className="h-3.5 w-3.5" />
            <span className="text-xs">{dateLabel}</span>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="p-3">
              <Calendar
                mode="range"
                selected={dateFrom || dateTo ? { from: dateFrom, to: dateTo } : undefined}
                onSelect={handleRangeSelect}
                numberOfMonths={2}
                modifiers={activityDates?.length ? { hasActivity: activityDates } : undefined}
              />
            </div>
            {!!(dateFrom || dateTo) && (
              <div className="border-t px-3 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => {
                    onDateFromChange(undefined);
                    onDateToChange(undefined);
                  }}>
                  {t('filters.clearDates')}
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Spacer */}
        <div className="flex-1" />
      </div>

      {/* Active filter badges */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeStatuses.map(s => (
            <Badge key={s} variant="secondary" className="gap-1 ps-2 pe-1 py-0.5">
              <span className="text-xs">
                {tDyn(t, 'filters', s.toLowerCase())}
              </span>
              <button
                type="button"
                className="ms-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                onClick={() => removeFilter(s)}
                aria-label={tAria('removeFilter', {
                  label: tDyn(t, 'filters', s.toLowerCase()),
                })}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <button
            type="button"
            className="ms-1 text-xs text-muted-foreground hover:text-foreground underline"
            onClick={clearAllFilters}>
            {t('clearAll')}
          </button>
        </div>
      )}
    </div>
  );
}

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Calendar } from '@contractor-ops/ui/components/shadcn/calendar';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { CalendarIcon, X } from 'lucide-react';
import { memo, useCallback, useId, useMemo } from 'react';

import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';

const STATUS_OPTIONS = [
  { value: 'DRAFT', labelKey: 'filters.draft' },
  { value: 'LOCKED', labelKey: 'filters.locked' },
  { value: 'EXPORTED', labelKey: 'filters.exported' },
  { value: 'COMPLETED', labelKey: 'filters.completed' },
  { value: 'CANCELLED', labelKey: 'filters.cancelled' },
] as const;

interface StatusFilterOptionProps {
  value: string;
  inputId: string;
  label: string;
  checked: boolean;
  onToggle: (value: string) => void;
}

const StatusFilterOption = memo(function StatusFilterOption({
  value,
  inputId,
  label,
  checked,
  onToggle,
}: StatusFilterOptionProps) {
  const handleChange = useCallback(() => onToggle(value), [value, onToggle]);
  return (
    <label
      htmlFor={inputId}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
      <Checkbox id={inputId} checked={checked} onCheckedChange={handleChange} />
      <span>{label}</span>
    </label>
  );
});

interface FilterChipProps {
  value: string;
  label: string;
  ariaLabel: string;
  onRemove: (value: string) => void;
}

const FilterChip = memo(function FilterChip({
  value,
  label,
  ariaLabel,
  onRemove,
}: FilterChipProps) {
  const handleClick = useCallback(() => onRemove(value), [value, onRemove]);
  return (
    <Badge variant="secondary" className="gap-1 ps-2 pe-1 py-0.5">
      <span className="text-xs">{label}</span>
      <button
        type="button"
        className="ms-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
        onClick={handleClick}
        aria-label={ariaLabel}>
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
});

interface DataTableToolbarProps {
  activeStatuses: string[];
  onStatusChange: (statuses: string[]) => void;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
  activityDates?: Date[];
  isLoading?: boolean;
}

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
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: date-range selection state machine handling clear/extend/reset branches across from/to bounds
    (range: { from?: Date; to?: Date } | undefined, triggerDate: Date) => {
      if (!range) {
        onDateFromChange(undefined);
        onDateToChange(undefined);
        return;
      }

      if (dateFrom && dateTo && range.from && !range.to) {
        const clicked = triggerDate.getTime();
        const fromTime = dateFrom.getTime();
        const toTime = dateTo.getTime();

        if (clicked <= fromTime) {
          onDateFromChange(triggerDate);
        } else if (clicked >= toTime) {
          onDateToChange(triggerDate);
        } else {
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

  const toggleFilter = useCallback(
    (value: string) => {
      if (activeStatuses.includes(value)) {
        onStatusChange(activeStatuses.filter(s => s !== value));
      } else {
        onStatusChange([...activeStatuses, value]);
      }
    },
    [activeStatuses, onStatusChange],
  );

  const removeFilter = useCallback(
    (value: string) => {
      onStatusChange(activeStatuses.filter(s => s !== value));
    },
    [activeStatuses, onStatusChange],
  );

  const clearAllFilters = useCallback(() => {
    onStatusChange([]);
  }, [onStatusChange]);

  const handleClearDates = useCallback(() => {
    onDateFromChange(undefined);
    onDateToChange(undefined);
  }, [onDateFromChange, onDateToChange]);

  const activeFilterCount = activeStatuses.length;

  const renderStatusTrigger = useCallback(
    (props: React.HTMLAttributes<HTMLButtonElement>) => (
      <Button {...props} variant="outline" size="sm" className="h-8 gap-1.5" disabled={isLoading}>
        {t('filters.status')}
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
            {activeFilterCount}
          </Badge>
        )}
      </Button>
    ),
    [isLoading, t, activeFilterCount],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger render={renderStatusTrigger} />
          <PopoverContent className="w-52 p-0" align="start">
            <div className="p-4 space-y-2">
              <h4 className="text-[13px] font-medium text-foreground">{t('filters.status')}</h4>
              <div className="space-y-1">
                {STATUS_OPTIONS.map(option => (
                  <StatusFilterOption
                    key={option.value}
                    value={option.value}
                    inputId={`${reactId}-filter-${option.value}`}
                    label={t(option.labelKey)}
                    checked={activeStatuses.includes(option.value)}
                    onToggle={toggleFilter}
                  />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

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
                  onClick={handleClearDates}>
                  {t('filters.clearDates')}
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <div className="flex-1" />
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeStatuses.map(s => {
            const label = tDynLoose(t, 'filters', s.toLowerCase());
            return (
              <FilterChip
                key={s}
                value={s}
                label={label}
                ariaLabel={tAria('removeFilter', { label })}
                onRemove={removeFilter}
              />
            );
          })}
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

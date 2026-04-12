'use client';

import { CalendarIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ---------------------------------------------------------------------------
// Status chip definitions
// ---------------------------------------------------------------------------

const STATUS_CHIPS = [
  { key: 'all', label: 'all' },
  { key: 'DRAFT', label: 'draft' },
  { key: 'LOCKED', label: 'locked' },
  { key: 'EXPORTED', label: 'exported' },
  { key: 'COMPLETED', label: 'completed' },
  { key: 'CANCELLED', label: 'cancelled' },
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DataTableToolbarProps {
  activeStatus: string;
  onStatusChange: (status: string) => void;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataTableToolbar({
  activeStatus,
  onStatusChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: DataTableToolbarProps) {
  const t = useTranslations('Payments');

  const formatDate = useCallback((date: Date | undefined) => {
    if (!date) return '';
    return date.toLocaleDateString('pl-PL');
  }, []);

  const dateLabel = useMemo(() => {
    if (dateFrom && dateTo) {
      return `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
    }
    if (dateFrom) return `From ${formatDate(dateFrom)}`;
    if (dateTo) return `To ${formatDate(dateTo)}`;
    return t('filters.dateRange');
  }, [dateFrom, dateTo, formatDate, t]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Status chip bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {STATUS_CHIPS.map(chip => {
          const isActive = activeStatus === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => onStatusChange(chip.key)}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}>
              {t(`filters.${chip.label}` as Parameters<typeof t>[0])}
            </button>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Date range filter */}
      <Popover>
        <PopoverTrigger render={<Button variant="outline" size="sm" className="h-8 gap-1.5" />}>
          <CalendarIcon className="h-3.5 w-3.5" />
          <span className="text-xs">{dateLabel}</span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex gap-2 p-3">
            <div>
              <p className="text-xs font-medium mb-2 text-muted-foreground">From</p>
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={onDateFromChange}
                initialFocus
              />
            </div>
            <div>
              <p className="text-xs font-medium mb-2 text-muted-foreground">To</p>
              <Calendar mode="single" selected={dateTo} onSelect={onDateToChange} />
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <div className="border-t px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  onDateFromChange(undefined);
                  onDateToChange(undefined);
                }}>
                Clear dates
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

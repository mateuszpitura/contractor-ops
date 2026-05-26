import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { Filter, X } from 'lucide-react';
import { useCallback } from 'react';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';

interface FilterState {
  status: string[];
  matchStatus: string[];
  source: string[];
  overdue?: boolean;
}

interface DataTableFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  disabled?: boolean;
}

const INVOICE_STATUSES = [
  'RECEIVED',
  'UNDER_REVIEW',
  'APPROVAL_PENDING',
  'APPROVED',
  'REJECTED',
  'READY_FOR_PAYMENT',
  'PARTIALLY_PAID',
  'PAID',
  'VOID',
] as const;

const MATCH_STATUSES = [
  'UNMATCHED',
  'PARTIAL',
  'MATCHED',
  'DISCREPANCY',
  'MANUALLY_CONFIRMED',
] as const;

const INVOICE_SOURCES = ['MANUAL_UPLOAD', 'EMAIL_INTAKE'] as const;

export function DataTableFilters({
  filters,
  onFiltersChange,
  disabled: filtersDisabled,
}: DataTableFiltersProps) {
  const t = useTranslations('Invoices');

  const activeFilterCount =
    filters.status.length +
    filters.matchStatus.length +
    filters.source.length +
    (filters.overdue ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = useCallback(() => {
    onFiltersChange({
      status: [],
      matchStatus: [],
      source: [],
      overdue: false,
    });
  }, [onFiltersChange]);

  const toggleOverdue = useCallback(() => {
    onFiltersChange({ overdue: !filters.overdue });
  }, [filters.overdue, onFiltersChange]);

  const toggleFilterValue = useCallback(
    (key: 'status' | 'matchStatus' | 'source', value: string) => {
      const current = filters[key];
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      onFiltersChange({ [key]: next });
    },
    [filters, onFiltersChange],
  );

  const removeFilter = useCallback(
    (key: 'status' | 'matchStatus' | 'source', value: string) => {
      onFiltersChange({ [key]: filters[key].filter(v => v !== value) });
    },
    [filters, onFiltersChange],
  );

  return (
    <>
      <Button
        variant={filters.overdue ? 'default' : 'outline'}
        size="lg"
        disabled={filtersDisabled}
        onClick={toggleOverdue}
        className={filters.overdue ? 'bg-primary text-primary-foreground' : ''}>
        {t('overdueFilter')}
      </Button>

      <Popover>
        <PopoverTrigger
          render={props => (
            <Button {...props} variant="outline" size="lg" disabled={filtersDisabled}>
              <Filter className="h-3.5 w-3.5" />
              {t('filters')}
              {hasActiveFilters && (
                <Badge variant="secondary" className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          )}
        />
        <PopoverContent className="w-72 p-0" align="start">
          <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
            <FilterSection
              title={t('columns.status')}
              options={INVOICE_STATUSES.map(s => ({
                value: s,
                label: tDynLoose(t, 'status', enumKey(s)),
              }))}
              selected={filters.status}
              onToggle={value => toggleFilterValue('status', value)}
            />
            <FilterSection
              title={t('columns.matchStatus')}
              options={MATCH_STATUSES.map(s => ({
                value: s,
                label: tDynLoose(t, 'matchStatus', enumKey(s)),
              }))}
              selected={filters.matchStatus}
              onToggle={value => toggleFilterValue('matchStatus', value)}
            />
            <FilterSection
              title={t('columns.source')}
              options={INVOICE_SOURCES.map(s => ({
                value: s,
                label: tDynLoose(t, 'source', enumKey(s)),
              }))}
              selected={filters.source}
              onToggle={value => toggleFilterValue('source', value)}
            />
          </div>
        </PopoverContent>
      </Popover>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.overdue && <FilterBadge label={t('overdueFilter')} onRemove={toggleOverdue} />}
          {filters.status.map(s => (
            <FilterBadge
              key={`status-${s}`}
              label={tDynLoose(t, 'status', enumKey(s))}
              onRemove={() => removeFilter('status', s)}
            />
          ))}
          {filters.matchStatus.map(s => (
            <FilterBadge
              key={`matchStatus-${s}`}
              label={tDynLoose(t, 'matchStatus', enumKey(s))}
              onRemove={() => removeFilter('matchStatus', s)}
            />
          ))}
          {filters.source.map(s => (
            <FilterBadge
              key={`source-${s}`}
              label={tDynLoose(t, 'source', enumKey(s))}
              onRemove={() => removeFilter('source', s)}
            />
          ))}
          <button
            type="button"
            className="ms-1 text-xs text-muted-foreground hover:text-foreground underline"
            onClick={clearAllFilters}>
            {t('clearAll')}
          </button>
        </div>
      )}
    </>
  );
}

function FilterSection({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-[13px] font-medium text-foreground">{title}</h4>
      <div className="space-y-1">
        {options.map(option => (
          <label
            key={option.value}
            htmlFor={`inv-filter-${title}-${option.value}`}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
            <Checkbox
              id={`inv-filter-${title}-${option.value}`}
              checked={selected.includes(option.value)}
              onCheckedChange={() => onToggle(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  const tAria = useTranslations('Common.aria');

  return (
    <Badge variant="secondary" className="gap-1 ps-2 pe-1 py-0.5">
      <span className="text-xs">{label}</span>
      <button
        type="button"
        className="ms-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
        onClick={onRemove}
        aria-label={tAria('removeFilter', { label })}>
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

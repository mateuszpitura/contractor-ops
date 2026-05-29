import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@contractor-ops/ui/components/shadcn/popover';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { Filter, X } from 'lucide-react';
import { memo, useCallback, useId } from 'react';

import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key.js';

interface FilterState {
  status: string[];
  templateId: string[];
  overdueOnly: boolean;
}

interface DataTableFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  disabled?: boolean;
  templates: Array<{ id: string; name: string }>;
  children?: (trigger: React.ReactNode, badges: React.ReactNode) => React.ReactNode;
}

const RUN_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'BLOCKED'] as const;

/**
 * Filter popover and active filter badges for the workflow runs data table.
 */
export function DataTableFilters({
  filters,
  onFiltersChange,
  disabled: filtersDisabled,
  templates,
  children,
}: DataTableFiltersProps) {
  const t = useTranslations('Workflows');
  const reactId = useId();

  const activeFilterCount =
    filters.status.length + filters.templateId.length + (filters.overdueOnly ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = useCallback(() => {
    onFiltersChange({
      status: [],
      templateId: [],
      overdueOnly: false,
    });
  }, [onFiltersChange]);

  const toggleFilterValue = useCallback(
    (key: 'status' | 'templateId', value: string) => {
      const current = filters[key];
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      onFiltersChange({ [key]: next });
    },
    [filters, onFiltersChange],
  );

  const removeFilter = useCallback(
    (key: 'status' | 'templateId', value: string) => {
      onFiltersChange({ [key]: filters[key].filter(v => v !== value) });
    },
    [filters, onFiltersChange],
  );

  const handleStatusToggle = useCallback(
    (value: string) => toggleFilterValue('status', value),
    [toggleFilterValue],
  );
  const handleTemplateToggle = useCallback(
    (value: string) => toggleFilterValue('templateId', value),
    [toggleFilterValue],
  );
  const handleOverdueChange = useCallback(
    (checked: boolean) => onFiltersChange({ overdueOnly: checked === true }),
    [onFiltersChange],
  );
  const clearOverdue = useCallback(
    () => onFiltersChange({ overdueOnly: false }),
    [onFiltersChange],
  );

  const renderFilterTrigger = useCallback(
    (props: React.ComponentPropsWithoutRef<typeof Button>) => (
      <Button {...props} variant="outline" size="lg" disabled={filtersDisabled}>
        <Filter className="h-3.5 w-3.5" />
        {t('filters')}
        {!!hasActiveFilters && (
          <Badge variant="secondary" className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]">
            {activeFilterCount}
          </Badge>
        )}
      </Button>
    ),
    [filtersDisabled, t, hasActiveFilters, activeFilterCount],
  );

  const trigger = (
    <Popover>
      <PopoverTrigger render={renderFilterTrigger} />
      <PopoverContent className="w-80 p-0" align="start">
        <div className="max-h-[460px] overflow-y-auto p-4 space-y-4">
          <FilterSection
            title={t('columns.status')}
            options={RUN_STATUSES.map(s => ({
              value: s,
              label: tDynLoose(t, 'runStatus', enumKey(s)),
            }))}
            selected={filters.status}
            onToggle={handleStatusToggle}
          />

          <FilterSection
            title={t('filterTemplate')}
            options={templates.map(tmpl => ({
              value: tmpl.id,
              label: tmpl.name,
            }))}
            selected={filters.templateId}
            onToggle={handleTemplateToggle}
          />

          <div className="flex items-center justify-between">
            <Label
              htmlFor={`${reactId}-overdue-toggle`}
              className="text-[13px] font-medium text-foreground">
              {t('filterOverdueOnly')}
            </Label>
            <Switch
              id={`${reactId}-overdue-toggle`}
              checked={filters.overdueOnly}
              onCheckedChange={handleOverdueChange}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  const badges = hasActiveFilters ? (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.status.map(s => (
        <StatusFilterBadge
          key={`status-${s}`}
          statusValue={s}
          label={tDynLoose(t, 'runStatus', enumKey(s))}
          onRemove={removeFilter}
        />
      ))}
      {filters.templateId.map(tmplId => {
        const tmpl = templates.find(t => t.id === tmplId);
        return (
          <TemplateFilterBadge
            key={`template-${tmplId}`}
            templateValue={tmplId}
            label={tmpl?.name ?? tmplId}
            onRemove={removeFilter}
          />
        );
      })}
      {!!filters.overdueOnly && (
        <FilterBadge label={t('filterOverdueOnly')} onRemove={clearOverdue} />
      )}
      <button
        type="button"
        className="ms-1 text-xs text-muted-foreground hover:text-foreground underline"
        onClick={clearAllFilters}>
        {t('clearAll')}
      </button>
    </div>
  ) : null;

  if (children) return children(trigger, badges);

  return (
    <>
      {trigger}
      {badges}
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
  const filterSectionId = useId();
  if (options.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-[13px] font-medium text-foreground">{title}</h4>
      <div className="space-y-1">
        {options.map(option => (
          <FilterSectionOption
            key={option.value}
            optionValue={option.value}
            label={option.label}
            checked={selected.includes(option.value)}
            inputId={`${filterSectionId}-${option.value}`}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

const FilterSectionOption = memo(function FilterSectionOption({
  optionValue,
  label,
  checked,
  inputId,
  onToggle,
}: {
  optionValue: string;
  label: string;
  checked: boolean;
  inputId: string;
  onToggle: (value: string) => void;
}) {
  const handleCheckedChange = useCallback(() => onToggle(optionValue), [onToggle, optionValue]);
  return (
    <label
      htmlFor={inputId}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
      <Checkbox id={inputId} checked={checked} onCheckedChange={handleCheckedChange} />
      <span>{label}</span>
    </label>
  );
});

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

const StatusFilterBadge = memo(function StatusFilterBadge({
  statusValue,
  label,
  onRemove,
}: {
  statusValue: string;
  label: string;
  onRemove: (key: 'status' | 'templateId', value: string) => void;
}) {
  const handleRemove = useCallback(() => onRemove('status', statusValue), [onRemove, statusValue]);
  return <FilterBadge label={label} onRemove={handleRemove} />;
});

const TemplateFilterBadge = memo(function TemplateFilterBadge({
  templateValue,
  label,
  onRemove,
}: {
  templateValue: string;
  label: string;
  onRemove: (key: 'status' | 'templateId', value: string) => void;
}) {
  const handleRemove = useCallback(
    () => onRemove('templateId', templateValue),
    [onRemove, templateValue],
  );
  return <FilterBadge label={label} onRemove={handleRemove} />;
});

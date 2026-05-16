'use client';

import { useQuery } from '@tanstack/react-query';
import { Filter, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useId } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { enumKey } from '@/lib/enum-key';
import { trpc } from '@/trpc/init';
import { tDyn } from '@/i18n/typed-keys';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FilterState {
  status: string[];
  templateId: string[];
  overdueOnly: boolean;
}

interface DataTableFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  /** Disable all interactive filter controls (initial data load). */
  disabled?: boolean;
  /**
   * Render callback receiving (trigger, badges) so the parent can place
   * the popover button inline with search and the badges on a separate row.
   * When omitted, both render stacked in a fragment.
   */
  children?: (trigger: React.ReactNode, badges: React.ReactNode) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Filter option sets
// ---------------------------------------------------------------------------

const RUN_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'BLOCKED'] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Filter popover and active filter badges for the workflow runs data table.
 */
export function DataTableFilters({
  filters,
  onFiltersChange,
  disabled: filtersDisabled,
  children,
}: DataTableFiltersProps) {
  const t = useTranslations('Workflows');
  const reactId = useId();

  // Fetch templates for template filter
  const templatesQuery = useQuery(
    trpc.workflow.listTemplates.queryOptions({
      page: 1,
      pageSize: 50,
    }),
  );
  const templates =
    (templatesQuery.data as { items: Array<{ id: string; name: string }> } | undefined)?.items ??
    [];

  // Active filter count for badge
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

  const trigger = (
    <Popover>
      <PopoverTrigger
        // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
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
      <PopoverContent className="w-80 p-0" align="start">
        <div className="max-h-[460px] overflow-y-auto p-4 space-y-4">
          {/* Status */}
          <FilterSection
            title={t('columns.status')}
            options={RUN_STATUSES.map(s => ({
              value: s,
              label: tDyn(t, 'runStatus', enumKey(s)),
            }))}
            selected={filters.status}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onToggle={value => toggleFilterValue('status', value)}
          />

          {/* Template */}
          <FilterSection
            title={t('filterTemplate')}
            options={templates.map(tmpl => ({
              value: tmpl.id,
              label: tmpl.name,
            }))}
            selected={filters.templateId}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onToggle={value => toggleFilterValue('templateId', value)}
          />

          {/* Overdue only toggle */}
          <div className="flex items-center justify-between">
            <Label
              htmlFor={`${reactId}-overdue-toggle`}
              className="text-[13px] font-medium text-foreground">
              {t('filterOverdueOnly')}
            </Label>
            <Switch
              id={`${reactId}-overdue-toggle`}
              checked={filters.overdueOnly}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
              onCheckedChange={checked => onFiltersChange({ overdueOnly: checked === true })}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  const badges = hasActiveFilters ? (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.status.map(s => (
        <FilterBadge
          key={`status-${s}`}
          label={tDyn(t, 'runStatus', enumKey(s))}
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onRemove={() => removeFilter('status', s)}
        />
      ))}
      {filters.templateId.map(tmplId => {
        const tmpl = templates.find(t => t.id === tmplId);
        return (
          <FilterBadge
            key={`template-${tmplId}`}
            label={tmpl?.name ?? tmplId}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onRemove={() => removeFilter('templateId', tmplId)}
          />
        );
      })}
      {!!filters.overdueOnly && (
        <FilterBadge
          label={t('filterOverdueOnly')}
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onRemove={() => onFiltersChange({ overdueOnly: false })}
        />
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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
          <label
            key={option.value}
            htmlFor={`${filterSectionId}-${option.value}`}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
            <Checkbox
              id={`${filterSectionId}-${option.value}`}
              checked={selected.includes(option.value)}
              // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
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

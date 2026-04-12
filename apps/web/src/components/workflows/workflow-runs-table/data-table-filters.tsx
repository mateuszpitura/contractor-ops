"use client";

import { useQuery } from "@tanstack/react-query";
import { Filter, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/trpc/init";

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
}

// ---------------------------------------------------------------------------
// Filter option sets
// ---------------------------------------------------------------------------

const RUN_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "BLOCKED"] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Filter popover and active filter badges for the workflow runs data table.
 */
export function DataTableFilters({ filters, onFiltersChange }: DataTableFiltersProps) {
  const t = useTranslations("Workflows");

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
    (key: "status" | "templateId", value: string) => {
      const current = filters[key];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onFiltersChange({ [key]: next });
    },
    [filters, onFiltersChange],
  );

  const removeFilter = useCallback(
    (key: "status" | "templateId", value: string) => {
      onFiltersChange({ [key]: filters[key].filter((v) => v !== value) });
    },
    [filters, onFiltersChange],
  );

  return (
    <>
      {/* Filter popover button + overdue toggle */}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger
            render={(props) => (
              <Button {...props} variant="outline" size="lg">
                <Filter className="h-3.5 w-3.5" />
                {t("filters")}
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
                title={t("columns.status")}
                options={RUN_STATUSES.map((s) => ({
                  value: s,
                  label: t(`runStatus.${s}` as Parameters<typeof t>[0]),
                }))}
                selected={filters.status}
                onToggle={(value) => toggleFilterValue("status", value)}
              />

              {/* Template */}
              <FilterSection
                title={t("filterTemplate")}
                options={templates.map((tmpl) => ({
                  value: tmpl.id,
                  label: tmpl.name,
                }))}
                selected={filters.templateId}
                onToggle={(value) => toggleFilterValue("templateId", value)}
              />

              {/* Overdue only toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="overdue-toggle" className="text-[13px] font-medium text-foreground">
                  {t("filterOverdueOnly")}
                </Label>
                <Switch
                  id="overdue-toggle"
                  checked={filters.overdueOnly}
                  onCheckedChange={(checked) => onFiltersChange({ overdueOnly: checked === true })}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.status.map((s) => (
            <FilterBadge
              key={`status-${s}`}
              label={t(`runStatus.${s}` as Parameters<typeof t>[0])}
              onRemove={() => removeFilter("status", s)}
            />
          ))}
          {filters.templateId.map((tmplId) => {
            const tmpl = templates.find((t) => t.id === tmplId);
            return (
              <FilterBadge
                key={`template-${tmplId}`}
                label={tmpl?.name ?? tmplId}
                onRemove={() => removeFilter("templateId", tmplId)}
              />
            );
          })}
          {filters.overdueOnly && (
            <FilterBadge
              label={t("filterOverdueOnly")}
              onRemove={() => onFiltersChange({ overdueOnly: false })}
            />
          )}
          <button
            type="button"
            className="ms-1 text-xs text-muted-foreground hover:text-foreground underline"
            onClick={clearAllFilters}
          >
            {t("clearAll")}
          </button>
        </div>
      )}
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
  if (options.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-[13px] font-medium text-foreground">{title}</h4>
      <div className="space-y-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent"
          >
            <Checkbox
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
  const tAria = useTranslations("Common.aria");

  return (
    <Badge variant="secondary" className="gap-1 ps-2 pe-1 py-0.5">
      <span className="text-xs">{label}</span>
      <button
        type="button"
        className="ms-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
        onClick={onRemove}
        aria-label={tAria("removeFilter", { label })}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

"use client";

import { useCallback } from "react";
import { Filter, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FilterState {
  status: string[];
  source: string[];
}

interface DataTableFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
}

// ---------------------------------------------------------------------------
// Filter option sets
// ---------------------------------------------------------------------------

const INVOICE_STATUSES = [
  "RECEIVED",
  "UNDER_REVIEW",
  "APPROVAL_PENDING",
  "APPROVED",
  "REJECTED",
  "READY_FOR_PAYMENT",
  "PARTIALLY_PAID",
  "PAID",
  "VOID",
] as const;

const INVOICE_SOURCES = ["MANUAL_UPLOAD", "EMAIL_INTAKE"] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Filter popover and active filter badges for the invoice data table.
 */
export function DataTableFilters({
  filters,
  onFiltersChange,
}: DataTableFiltersProps) {
  const t = useTranslations("Invoices");

  // Active filter count for badge
  const activeFilterCount = filters.status.length + filters.source.length;
  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = useCallback(() => {
    onFiltersChange({
      status: [],
      source: [],
    });
  }, [onFiltersChange]);

  const toggleFilterValue = useCallback(
    (key: "status" | "source", value: string) => {
      const current = filters[key];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onFiltersChange({ [key]: next });
    },
    [filters, onFiltersChange],
  );

  const removeFilter = useCallback(
    (key: "status" | "source", value: string) => {
      onFiltersChange({ [key]: filters[key].filter((v) => v !== value) });
    },
    [filters, onFiltersChange],
  );

  return (
    <>
      {/* Filter popover button */}
      <Popover>
        <PopoverTrigger
          render={(props) => (
            <Button {...props} variant="outline" size="lg">
              <Filter className="h-3.5 w-3.5" />
              {t("filters")}
              {hasActiveFilters && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 w-5 rounded-full p-0 text-[10px]"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          )}
        />
        <PopoverContent className="w-72 p-0" align="start">
          <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
            {/* Status */}
            <FilterSection
              title={t("columns.status")}
              options={INVOICE_STATUSES.map((s) => ({
                value: s,
                label: t(`status.${s}`),
              }))}
              selected={filters.status}
              onToggle={(value) => toggleFilterValue("status", value)}
            />

            {/* Source */}
            <FilterSection
              title={t("columns.source")}
              options={INVOICE_SOURCES.map((s) => ({
                value: s,
                label: t(`source.${s}`),
              }))}
              selected={filters.source}
              onToggle={(value) => toggleFilterValue("source", value)}
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.status.map((s) => (
            <FilterBadge
              key={`status-${s}`}
              label={t(`status.${s}` as Parameters<typeof t>[0])}
              onRemove={() => removeFilter("status", s)}
            />
          ))}
          {filters.source.map((s) => (
            <FilterBadge
              key={`source-${s}`}
              label={t(`source.${s}` as Parameters<typeof t>[0])}
              onRemove={() => removeFilter("source", s)}
            />
          ))}
          <button
            type="button"
            className="ml-1 text-xs text-muted-foreground hover:text-foreground underline"
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

function FilterBadge({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  const tAria = useTranslations("Common.aria");

  return (
    <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-0.5">
      <span className="text-xs">{label}</span>
      <button
        type="button"
        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
        onClick={onRemove}
        aria-label={tAria("removeFilter", { label })}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

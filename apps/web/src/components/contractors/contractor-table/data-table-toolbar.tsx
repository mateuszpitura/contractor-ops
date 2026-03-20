"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, Loader2, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  lifecycleStage: string[];
  owner: string[];
  team: string[];
  billingModel: string[];
  health: string[];
}

interface DataTableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  isSearching?: boolean;
  onAddContractor: () => void;
}

// ---------------------------------------------------------------------------
// Filter option sets
// ---------------------------------------------------------------------------

const LIFECYCLE_STAGES = [
  "DRAFT",
  "ONBOARDING",
  "ACTIVE",
  "OFFBOARDING",
  "ENDED",
] as const;

const BILLING_MODELS = ["FIXED", "HOURLY", "PROJECT", "MILESTONE"] as const;

const HEALTH_OPTIONS = ["green", "yellow", "red"] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Toolbar with search input, filter popover, active filter badges, and CTA.
 */
export function DataTableToolbar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  isSearching,
  onAddContractor,
}: DataTableToolbarProps) {
  const t = useTranslations("Contractors");

  // Debounced search
  const [localSearch, setLocalSearch] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const handleSearchInput = useCallback(
    (value: string) => {
      setLocalSearch(value);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearchChange(value.length >= 2 ? value : "");
      }, 300);
    },
    [onSearchChange],
  );

  // Fetch users for owner filter
  const usersQuery = useQuery(trpc.user.list.queryOptions());
  const users = Array.isArray(usersQuery.data) ? usersQuery.data : [];

  // Active filter count for badge
  const activeFilterCount =
    filters.status.length +
    filters.lifecycleStage.length +
    filters.owner.length +
    filters.team.length +
    filters.billingModel.length +
    filters.health.length;

  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = () => {
    onFiltersChange({
      status: [],
      lifecycleStage: [],
      owner: [],
      team: [],
      billingModel: [],
      health: [],
    });
  };

  const toggleFilterValue = (
    key: keyof FilterState,
    value: string,
  ) => {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ [key]: next });
  };

  const removeFilter = (key: keyof FilterState, value: string) => {
    onFiltersChange({ [key]: filters[key].filter((v) => v !== value) });
  };

  return (
    <div className="space-y-2">
      {/* Main toolbar row */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={localSearch}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="h-9 pl-9 pr-8"
          />
          {isSearching && (
            <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Filters popover */}
        <Popover>
          <PopoverTrigger
            render={(props) => (
              <Button {...props} variant="outline" size="sm" className="h-9 gap-1.5">
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
              {/* Status / Lifecycle Stage */}
              <FilterSection
                title={t("columns.status")}
                options={LIFECYCLE_STAGES.map((stage) => ({
                  value: stage,
                  label: t(`lifecycle.${stage}`),
                }))}
                selected={filters.lifecycleStage}
                onToggle={(value) =>
                  toggleFilterValue("lifecycleStage", value)
                }
              />

              {/* Owner */}
              <FilterSection
                title={t("columns.owner")}
                options={(users as Array<{ id?: string; userId?: string; name?: string | null; email?: string | null }>).map(
                  (user) => ({
                    value: user.id ?? user.userId ?? "",
                    label: user.name ?? user.email ?? "Unknown",
                  }),
                )}
                selected={filters.owner}
                onToggle={(value) => toggleFilterValue("owner", value)}
              />

              {/* Billing model */}
              <FilterSection
                title={t("columns.billingModel")}
                options={BILLING_MODELS.map((model) => ({
                  value: model,
                  label: model,
                }))}
                selected={filters.billingModel}
                onToggle={(value) =>
                  toggleFilterValue("billingModel", value)
                }
              />

              {/* Compliance health */}
              <FilterSection
                title={t("columns.health")}
                options={HEALTH_OPTIONS.map((health) => ({
                  value: health,
                  label: t(`health.${health}`),
                }))}
                selected={filters.health}
                onToggle={(value) => toggleFilterValue("health", value)}
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Add contractor CTA */}
        <Button size="sm" className="h-9" onClick={onAddContractor}>
          {t("addContractor")}
        </Button>
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.lifecycleStage.map((stage) => (
            <FilterBadge
              key={`stage-${stage}`}
              label={t(`lifecycle.${stage}` as Parameters<typeof t>[0])}
              onRemove={() => removeFilter("lifecycleStage", stage)}
            />
          ))}
          {filters.owner.map((ownerId) => {
            const user = (users as Array<{ id?: string; userId?: string; name?: string | null; email?: string | null }>).find(
              (u) => (u.id ?? u.userId) === ownerId,
            );
            return (
              <FilterBadge
                key={`owner-${ownerId}`}
                label={user?.name ?? user?.email ?? ownerId}
                onRemove={() => removeFilter("owner", ownerId)}
              />
            );
          })}
          {filters.billingModel.map((model) => (
            <FilterBadge
              key={`billing-${model}`}
              label={model}
              onRemove={() => removeFilter("billingModel", model)}
            />
          ))}
          {filters.health.map((health) => (
            <FilterBadge
              key={`health-${health}`}
              label={t(`health.${health}` as Parameters<typeof t>[0])}
              onRemove={() => removeFilter("health", health)}
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
    </div>
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
  return (
    <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-0.5">
      <span className="text-xs">{label}</span>
      <button
        type="button"
        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

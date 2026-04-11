"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Filter, X } from "lucide-react";
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
  type: string[];
  billingModel: string[];
  ownerUserId: string[];
  endDateFrom: string;
  endDateTo: string;
  complianceRiskLevel: string[];
}

interface DataTableFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
}

// ---------------------------------------------------------------------------
// Filter option sets
// ---------------------------------------------------------------------------

const CONTRACT_STATUSES = [
  "DRAFT",
  "PENDING_SIGNATURE",
  "ACTIVE",
  "EXPIRING",
  "EXPIRED",
  "TERMINATED",
  "SUPERSEDED",
  "ARCHIVED",
] as const;

const CONTRACT_TYPES = [
  "B2B_MASTER_SERVICE",
  "STATEMENT_OF_WORK",
  "NDA",
  "IP_ASSIGNMENT",
  "DPA",
  "OTHER",
] as const;

const BILLING_MODELS = [
  "MONTHLY_RETAINER",
  "HOURLY",
  "DAILY",
  "MILESTONE",
  "DELIVERABLE_BASED",
  "MIXED",
] as const;

const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Filter popover and active filter badges for the contract data table.
 */
export function DataTableFilters({
  filters,
  onFiltersChange,
}: DataTableFiltersProps) {
  const t = useTranslations("Contracts");

  // Fetch users for owner filter
  const usersQuery = useQuery(trpc.user.list.queryOptions());
  const users = Array.isArray(usersQuery.data) ? usersQuery.data : [];

  // Active filter count for badge
  const activeFilterCount =
    filters.status.length +
    filters.type.length +
    filters.billingModel.length +
    filters.ownerUserId.length +
    filters.complianceRiskLevel.length +
    (filters.endDateFrom ? 1 : 0) +
    (filters.endDateTo ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = useCallback(() => {
    onFiltersChange({
      status: [],
      type: [],
      billingModel: [],
      ownerUserId: [],
      endDateFrom: "",
      endDateTo: "",
      complianceRiskLevel: [],
    });
  }, [onFiltersChange]);

  const toggleFilterValue = useCallback(
    (key: "status" | "type" | "billingModel" | "ownerUserId" | "complianceRiskLevel", value: string) => {
      const current = filters[key];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onFiltersChange({ [key]: next });
    },
    [filters, onFiltersChange],
  );

  const removeFilter = useCallback(
    (key: "status" | "type" | "billingModel" | "ownerUserId" | "complianceRiskLevel", value: string) => {
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
                  className="ms-1 h-5 w-5 rounded-full p-0 text-[10px]"
                >
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
              options={CONTRACT_STATUSES.map((s) => ({
                value: s,
                label: t(`status.${s}`),
              }))}
              selected={filters.status}
              onToggle={(value) => toggleFilterValue("status", value)}
            />

            {/* Type */}
            <FilterSection
              title={t("columns.type")}
              options={CONTRACT_TYPES.map((ct) => ({
                value: ct,
                label: t(`type.${ct}`),
              }))}
              selected={filters.type}
              onToggle={(value) => toggleFilterValue("type", value)}
            />

            {/* Billing model */}
            <FilterSection
              title={t("columns.billingCycle")}
              options={BILLING_MODELS.map((bm) => ({
                value: bm,
                label: t(`billingModel.${bm}`),
              }))}
              selected={filters.billingModel}
              onToggle={(value) => toggleFilterValue("billingModel", value)}
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
              selected={filters.ownerUserId}
              onToggle={(value) => toggleFilterValue("ownerUserId", value)}
            />

            {/* Compliance risk */}
            <FilterSection
              title={t("columns.complianceRisk")}
              options={RISK_LEVELS.map((rl) => ({
                value: rl,
                label: t(`risk.${rl}`),
              }))}
              selected={filters.complianceRiskLevel}
              onToggle={(value) =>
                toggleFilterValue("complianceRiskLevel", value)
              }
            />

            {/* End date range */}
            <div className="space-y-2">
              <h4 className="text-[13px] font-medium text-foreground">
                {t("columns.endDate")}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    {t("dateFrom")}
                  </label>
                  <div className="relative">
                    <Calendar className="absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="date"
                      value={filters.endDateFrom}
                      onChange={(e) =>
                        onFiltersChange({ endDateFrom: e.target.value })
                      }
                      className="h-8 ps-7 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    {t("dateTo")}
                  </label>
                  <div className="relative">
                    <Calendar className="absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="date"
                      value={filters.endDateTo}
                      onChange={(e) =>
                        onFiltersChange({ endDateTo: e.target.value })
                      }
                      className="h-8 ps-7 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
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
          {filters.type.map((ct) => (
            <FilterBadge
              key={`type-${ct}`}
              label={t(`type.${ct}` as Parameters<typeof t>[0])}
              onRemove={() => removeFilter("type", ct)}
            />
          ))}
          {filters.billingModel.map((bm) => (
            <FilterBadge
              key={`billing-${bm}`}
              label={t(`billingModel.${bm}` as Parameters<typeof t>[0])}
              onRemove={() => removeFilter("billingModel", bm)}
            />
          ))}
          {filters.ownerUserId.map((ownerId) => {
            const user = (users as Array<{ id?: string; userId?: string; name?: string | null; email?: string | null }>).find(
              (u) => (u.id ?? u.userId) === ownerId,
            );
            return (
              <FilterBadge
                key={`owner-${ownerId}`}
                label={user?.name ?? user?.email ?? ownerId}
                onRemove={() => removeFilter("ownerUserId", ownerId)}
              />
            );
          })}
          {filters.complianceRiskLevel.map((rl) => (
            <FilterBadge
              key={`risk-${rl}`}
              label={t(`risk.${rl}` as Parameters<typeof t>[0])}
              onRemove={() => removeFilter("complianceRiskLevel", rl)}
            />
          ))}
          {filters.endDateFrom && (
            <FilterBadge
              label={`${t("dateFrom")}: ${filters.endDateFrom}`}
              onRemove={() => onFiltersChange({ endDateFrom: "" })}
            />
          )}
          {filters.endDateTo && (
            <FilterBadge
              label={`${t("dateTo")}: ${filters.endDateTo}`}
              onRemove={() => onFiltersChange({ endDateTo: "" })}
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

function FilterBadge({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
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

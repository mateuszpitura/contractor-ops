"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatusChipBarProps {
  /** Currently active status filter from URL state */
  activeStatus: string;
  /** Callback to set the active status filter */
  onStatusChange: (status: string) => void;
}

// ---------------------------------------------------------------------------
// Chip definitions
// ---------------------------------------------------------------------------

const STATUS_CHIPS = [
  { key: "", labelKey: "chips.all" },
  { key: "RECEIVED", labelKey: "chips.received" },
  { key: "MATCHED", labelKey: "chips.matched" },
  { key: "UNMATCHED", labelKey: "chips.unmatched" },
  { key: "DISCREPANCY", labelKey: "chips.discrepancy" },
  { key: "APPROVAL_PENDING", labelKey: "chips.pendingApproval" },
  { key: "APPROVED", labelKey: "chips.approved" },
  { key: "READY_FOR_PAYMENT", labelKey: "chips.readyForPayment" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Horizontal row of Badge-style chips above the invoice table.
 * Each chip shows a live count from trpc.invoice.statusCounts.
 * Active chip gets primary styling, inactive gets muted.
 * Overflow: horizontal scroll with fade gradient on narrow screens.
 */
export function StatusChipBar({ activeStatus, onStatusChange }: StatusChipBarProps) {
  const t = useTranslations("Invoices");

  // Fetch live counts
  const countsQuery = useQuery(trpc.invoice.statusCounts.queryOptions());
  const counts = (countsQuery.data ?? {}) as Record<string, number>;

  // Compute total for "All" chip
  const totalCount = Object.entries(counts)
    .filter(([key]) => key.startsWith("status:"))
    .reduce((sum, [, count]) => sum + count, 0);

  const getCount = (key: string): number => {
    if (key === "") return totalCount;
    // statusCounts uses "status:STATUS" or "matchStatus:STATUS" keys
    return (counts[`status:${key}`] ?? 0) + (counts[`matchStatus:${key}`] ?? 0);
  };

  if (countsQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STATUS_CHIPS.map((chip) => (
          <Skeleton key={chip.key} className="h-8 w-24 rounded-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_CHIPS.map((chip) => {
          const isActive = activeStatus === chip.key;
          const count = getCount(chip.key);

          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => onStatusChange(chip.key)}
              className="shrink-0"
            >
              <Badge
                variant="secondary"
                className={`cursor-pointer px-3 py-1.5 text-[13px] transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t(chip.labelKey as Parameters<typeof t>[0])}
                <span className="ms-1.5 tabular-nums">({count})</span>
              </Badge>
            </button>
          );
        })}
      </div>
      {/* Fade gradient for overflow on narrow screens */}
      <div className="pointer-events-none absolute inset-y-0 end-0 w-8 bg-gradient-to-l from-background to-transparent xl:hidden" />
    </div>
  );
}

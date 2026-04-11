"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow, differenceInDays, isPast } from "date-fns";

// ---------------------------------------------------------------------------
// Row type matching the tRPC contract.list response shape
// ---------------------------------------------------------------------------

export type ContractRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  currency: string;
  billingModel: string;
  rateType: string;
  rateValueMinor: number | null;
  complianceRiskLevel: string | null;
  contractor: {
    id: string;
    legalName: string;
    displayName: string | null;
  };
  internalOwner: {
    id: string;
    name: string | null;
  } | null;
};

// ---------------------------------------------------------------------------
// Status badge styling per UI-SPEC
// ---------------------------------------------------------------------------

const statusBadgeColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border border-border",
  PENDING_SIGNATURE: "bg-muted text-muted-foreground border border-border",
  ACTIVE: "bg-green-500/10 text-green-600 dark:text-green-400",
  EXPIRING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  EXPIRED: "bg-red-500/10 text-red-600 dark:text-red-400",
  TERMINATED: "bg-muted text-muted-foreground border border-border",
  SUPERSEDED: "bg-muted/50 text-muted-foreground/60 border border-border/50",
  ARCHIVED: "bg-muted text-muted-foreground border border-border",
};

// ---------------------------------------------------------------------------
// Compliance risk badge styling
// ---------------------------------------------------------------------------

const riskBadgeColors: Record<string, string> = {
  LOW: "bg-green-500/10 text-green-600 dark:text-green-400",
  MEDIUM: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  HIGH: "bg-red-500/10 text-red-600 dark:text-red-400",
};

// ---------------------------------------------------------------------------
// Column factory
// ---------------------------------------------------------------------------

type TranslateFunction = (key: string, params?: Record<string, string | number>) => string;

/**
 * Returns all column definitions for the contract data table.
 * Accepts a translation function for headers and labels.
 */
export function getColumns(t: TranslateFunction): ColumnDef<ContractRow>[] {
  return [
    // 1. Select checkbox
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(value) =>
            table.toggleAllPageRowsSelected(!!value)
          }
          aria-label={t("columns.selectAll")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t("columns.selectRow")}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },

    // 2. Title
    {
      accessorKey: "title",
      header: t("columns.title"),
      cell: ({ row }) => (
        <div className="min-w-[160px]">
          <span className="font-medium">{row.original.title}</span>
        </div>
      ),
      enableHiding: false,
    },

    // 3. Contractor
    {
      id: "contractor",
      accessorFn: (row) =>
        row.contractor.displayName ?? row.contractor.legalName,
      header: t("columns.contractor"),
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.contractor.displayName ??
            row.original.contractor.legalName}
        </span>
      ),
    },

    // 4. Type
    {
      accessorKey: "type",
      header: t("columns.type"),
      cell: ({ row }) => (
        <Badge variant="secondary" className="whitespace-nowrap">
          {t(`type.${row.original.type}`)}
        </Badge>
      ),
    },

    // 5. Status
    {
      accessorKey: "status",
      header: t("columns.status"),
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge
            variant="secondary"
            className={statusBadgeColors[status] ?? ""}
          >
            {t(`status.${status}`)}
          </Badge>
        );
      },
    },

    // 6. Start date
    {
      accessorKey: "startDate",
      header: t("columns.startDate"),
      cell: ({ row }) => {
        const startDate = row.original.startDate;
        if (!startDate)
          return <span className="text-muted-foreground">&mdash;</span>;
        try {
          return (
            <span className="text-sm">
              {new Date(startDate).toLocaleDateString("pl-PL")}
            </span>
          );
        } catch {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
      },
    },

    // 7. End date with days remaining tooltip
    {
      accessorKey: "endDate",
      header: t("columns.endDate"),
      cell: ({ row }) => {
        const endDate = row.original.endDate;
        if (!endDate)
          return <span className="text-muted-foreground">&mdash;</span>;
        try {
          const date = new Date(endDate);
          const daysRemaining = differenceInDays(date, new Date());
          const expired = isPast(date);
          const tooltipText = expired
            ? t("daysExpired", { count: Math.abs(daysRemaining) })
            : t("daysRemaining", { count: daysRemaining });

          return (
            <Tooltip>
              <TooltipTrigger
                render={(props) => (
                  <span {...props} className="text-sm cursor-default">
                    {date.toLocaleDateString("pl-PL")}
                  </span>
                )}
              />
              <TooltipContent>{tooltipText}</TooltipContent>
            </Tooltip>
          );
        } catch {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
      },
    },

    // 8. Rate
    {
      accessorKey: "rateValueMinor",
      header: t("columns.rate"),
      enableSorting: false,
      cell: ({ row }) => {
        const minor = row.original.rateValueMinor;
        if (typeof minor !== "number")
          return <span className="text-muted-foreground">&mdash;</span>;

        const formatted = new Intl.NumberFormat("pl-PL", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(minor / 100);

        return (
          <span className="font-mono text-sm tabular-nums">
            {formatted}
          </span>
        );
      },
    },

    // 9. Currency
    {
      accessorKey: "currency",
      header: t("columns.currency"),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm">{row.original.currency}</span>
      ),
    },

    // 10. Billing cycle
    {
      accessorKey: "billingModel",
      header: t("columns.billingCycle"),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm">
          {t(`billingModel.${row.original.billingModel}`)}
        </span>
      ),
    },

    // 11. Owner
    {
      id: "internalOwner",
      header: t("columns.owner"),
      cell: ({ row }) => {
        const owner = row.original.internalOwner;
        if (!owner)
          return <span className="text-muted-foreground">&mdash;</span>;
        return <span className="text-sm">{owner.name ?? owner.id}</span>;
      },
      enableSorting: false,
    },

    // 12. Compliance risk
    {
      accessorKey: "complianceRiskLevel",
      header: t("columns.complianceRisk"),
      cell: ({ row }) => {
        const risk = row.original.complianceRiskLevel;
        if (!risk)
          return <span className="text-muted-foreground">&mdash;</span>;
        return (
          <Badge
            variant="secondary"
            className={riskBadgeColors[risk] ?? ""}
          >
            {t(`risk.${risk}`)}
          </Badge>
        );
      },
      enableSorting: false,
    },
  ];
}

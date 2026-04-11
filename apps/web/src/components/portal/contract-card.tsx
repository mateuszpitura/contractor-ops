"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContractCardContract {
  id: string;
  title: string;
  type: string;
  status: string;
  startDate: Date | string;
  endDate: Date | string | null;
  currency: string;
  rateType: string | null;
  rateValueMinor: number | null;
  contractNumber: string | null;
}

interface ContractCardProps {
  contract: ContractCardContract;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a date to abbreviated month + year (e.g. "Jan 2026").
 */
function formatMonthYear(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(d);
}

/**
 * Format minor-unit amount to display currency (e.g. "12,000 PLN").
 */
function formatAmount(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/**
 * Map rate type to period abbreviation.
 */
function ratePeriodLabel(rateType: string): string {
  switch (rateType) {
    case "MONTHLY":
      return "/mo";
    case "HOURLY":
      return "/hr";
    case "DAILY":
      return "/day";
    case "FIXED":
      return " fixed";
    default:
      return "";
  }
}

/**
 * Map contract status to badge variant.
 */
function statusBadgeVariant(status: string) {
  switch (status) {
    case "ACTIVE":
      return "default" as const;
    case "EXPIRING":
      return "outline" as const;
    case "EXPIRED":
      return "secondary" as const;
    default:
      return "secondary" as const;
  }
}

// ---------------------------------------------------------------------------
// ContractCard
// ---------------------------------------------------------------------------

/**
 * Clickable contract card for the contracts list page.
 *
 * Per UI-SPEC D-02 / PORT-02: card grid with title, contract number,
 * date range, rate, and status badge. Links to contract detail.
 */
export function ContractCard({ contract, className }: ContractCardProps) {
  const dateRange = [
    formatMonthYear(contract.startDate),
    contract.endDate ? formatMonthYear(contract.endDate) : "Ongoing",
  ].join(" - ");

  const rate =
    contract.rateValueMinor != null && contract.rateType
      ? `${formatAmount(contract.rateValueMinor, contract.currency)}${ratePeriodLabel(contract.rateType)}`
      : null;

  return (
    <Link href={`/portal/contracts/${contract.id}`} className="block">
      <Card
        className={cn(
          "cursor-pointer transition-colors hover:border-primary/50",
          className,
        )}
      >
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug truncate">
                {contract.title}
              </p>
              {contract.contractNumber && (
                <p className="text-[13px] text-muted-foreground">
                  {contract.contractNumber}
                </p>
              )}
            </div>
            <Badge variant={statusBadgeVariant(contract.status)}>
              {contract.status.charAt(0) + contract.status.slice(1).toLowerCase()}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-[13px] text-muted-foreground">
            <span>{dateRange}</span>
            {rate && <span className="font-medium text-foreground">{rate}</span>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// ContractCardSkeleton
// ---------------------------------------------------------------------------

/**
 * Loading skeleton matching ContractCard dimensions.
 */
export function ContractCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn(className)}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

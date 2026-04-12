"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRightLeft, ExternalLink } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { DeviationFlag } from "@/components/time/deviation-flag";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// Types (mirrors API response)
// ---------------------------------------------------------------------------

interface ReconciliationItem {
  invoice: {
    id: string;
    invoiceNumber: string;
    issueDate: string | Date;
    totalMinor: number;
    currency: string;
    servicePeriodStart: string | Date | null;
    servicePeriodEnd: string | Date | null;
  };
  contractor: {
    id: string;
    legalName: string;
  } | null;
  reconciliation: {
    approvedMinutes: number;
    rateValueMinor: number;
    rateType: string;
    hoursPerDay: number;
    expectedAmountMinor: number;
    invoicedAmountMinor: number;
    deviationMinor: number;
    deviationPercent: number;
    withinThreshold: boolean;
    thresholdPercent: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMinorUnits(minor: number): string {
  return new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function formatPeriod(item: ReconciliationItem): string {
  const start = item.invoice.servicePeriodStart;
  const end = item.invoice.servicePeriodEnd;
  if (start && end) {
    const s = typeof start === "string" ? new Date(start) : start;
    const e = typeof end === "string" ? new Date(end) : end;
    return `${format(s, "MMM d")} - ${format(e, "MMM d, yyyy")}`;
  }
  const issueDate =
    typeof item.invoice.issueDate === "string"
      ? new Date(item.invoice.issueDate)
      : item.invoice.issueDate;
  return format(issueDate, "MMM yyyy");
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ReconciliationSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={`skel-${i}`} className="flex items-center gap-4 rounded-lg border px-4 py-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Admin reconciliation view table (D-16).
 *
 * Shows all invoices with time deviation data. Default sort: deviation
 * percentage descending (highest first per UI-SPEC). Self-contained
 * with tRPC query.
 */
export function ReconciliationTable() {
  const query = useQuery(trpc.time.listReconciliations.queryOptions({}));

  const data = query.data as { items: ReconciliationItem[]; nextCursor?: string } | undefined;
  const items = data?.items ?? [];

  if (query.isLoading) {
    return <ReconciliationSkeleton />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ArrowRightLeft}
        heading="No reconciliation data"
        body="Reconciliation data appears when invoices have matching approved time entries."
      />
    );
  }

  return (
    <div className="rounded-xl border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contractor</TableHead>
            <TableHead>Period</TableHead>
            <TableHead className="text-end">Approved Hours</TableHead>
            <TableHead className="text-end">Expected Amount</TableHead>
            <TableHead className="text-end">Invoiced Amount</TableHead>
            <TableHead>Deviation</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.invoice.id}>
              <TableCell className="text-sm font-medium">
                {item.contractor?.legalName ?? "Unknown"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatPeriod(item)}</TableCell>
              <TableCell className="text-end text-sm font-medium tabular-nums">
                {formatHours(item.reconciliation.approvedMinutes)}
              </TableCell>
              <TableCell className="text-end text-sm tabular-nums">
                {formatMinorUnits(item.reconciliation.expectedAmountMinor)}{" "}
                <span className="text-muted-foreground">{item.invoice.currency}</span>
              </TableCell>
              <TableCell className="text-end text-sm tabular-nums">
                {formatMinorUnits(item.reconciliation.invoicedAmountMinor)}{" "}
                <span className="text-muted-foreground">{item.invoice.currency}</span>
              </TableCell>
              <TableCell>
                <DeviationFlag
                  deviationPercent={item.reconciliation.deviationPercent}
                  thresholdPercent={item.reconciliation.thresholdPercent}
                  expectedAmountMinor={item.reconciliation.expectedAmountMinor}
                  invoicedAmountMinor={item.reconciliation.invoicedAmountMinor}
                  rateValueMinor={item.reconciliation.rateValueMinor}
                  approvedMinutes={item.reconciliation.approvedMinutes}
                />
              </TableCell>
              <TableCell>
                <Link
                  href={`/invoices/${item.invoice.id}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="sr-only">View invoice</span>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

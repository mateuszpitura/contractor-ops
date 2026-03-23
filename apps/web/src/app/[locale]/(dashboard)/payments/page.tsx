"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { Banknote, CreditCard, Plus } from "lucide-react";

import { trpc } from "@/trpc/init";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

import {
  getColumns,
  type PaymentRunRow,
} from "@/components/payments/payment-run-table/columns";
import { PaymentRunDataTable } from "@/components/payments/payment-run-table/data-table";
import { DataTableToolbar } from "@/components/payments/payment-run-table/data-table-toolbar";
import { PaymentRunSidePanel } from "@/components/payments/payment-run-side-panel";
import { NewPaymentRunDialog } from "@/components/payments/new-payment-run-dialog";
import { BankStatementDialog } from "@/components/payments/bank-statement-dialog";

// ---------------------------------------------------------------------------
// Inner content (uses nuqs, needs Suspense boundary)
// ---------------------------------------------------------------------------

function PaymentsContent() {
  const t = useTranslations("Payments");
  const te = useTranslations("EmptyStates");

  // URL state via nuqs
  const [status, setStatus] = useQueryState(
    "status",
    parseAsString.withDefault("all"),
  );

  // Date range state (local, not URL-synced for simplicity)
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Cursor-based pagination
  const [cursors, setCursors] = useState<string[]>([]);
  const currentCursor = cursors[cursors.length - 1] ?? undefined;

  // Side panel state
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bankStatementRunId, setBankStatementRunId] = useState<string | null>(
    null,
  );

  // Build query input
  const queryInput = useMemo(
    () => ({
      status:
        status === "all"
          ? undefined
          : (status as
              | "DRAFT"
              | "LOCKED"
              | "EXPORTED"
              | "COMPLETED"
              | "FAILED"
              | "CANCELLED"),
      cursor: currentCursor,
      limit: 20,
      sortBy: "createdAt" as const,
      sortOrder: "desc" as const,
      dateFrom: dateFrom ?? undefined,
      dateTo: dateTo ?? undefined,
    }),
    [status, currentCursor, dateFrom, dateTo],
  );

  // Fetch payment runs
  const runsQuery = useQuery(trpc.payment.list.queryOptions(queryInput));

  const data = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = runsQuery.data as any;
    return (result?.items ?? []) as PaymentRunRow[];
  }, [runsQuery.data]);

  const nextCursor = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = runsQuery.data as any;
    return result?.nextCursor as string | undefined;
  }, [runsQuery.data]);

  // Status change resets pagination
  const handleStatusChange = useCallback(
    (newStatus: string) => {
      void setStatus(newStatus);
      setCursors([]);
    },
    [setStatus],
  );

  const handleDateFromChange = useCallback(
    (date: Date | undefined) => {
      setDateFrom(date);
      setCursors([]);
    },
    [],
  );

  const handleDateToChange = useCallback(
    (date: Date | undefined) => {
      setDateTo(date);
      setCursors([]);
    },
    [],
  );

  // Pagination handlers
  const handleNextPage = useCallback(() => {
    if (nextCursor) {
      setCursors((prev) => [...prev, nextCursor]);
    }
  }, [nextCursor]);

  const handlePreviousPage = useCallback(() => {
    setCursors((prev) => prev.slice(0, -1));
  }, []);

  // Row click
  const handleRowClick = useCallback((run: PaymentRunRow) => {
    setSelectedRunId(run.id);
    setSidePanelOpen(true);
  }, []);

  // Column definitions
  const columns = useMemo(
    () =>
      getColumns(
        (key: string) => t(key as Parameters<typeof t>[0]),
        {
          onDownloadExport: () => {
            // Download handled via side panel
          },
          onMarkAllPaid: (run) => {
            setSelectedRunId(run.id);
            setSidePanelOpen(true);
          },
          onCancelRun: (run) => {
            setSelectedRunId(run.id);
            setSidePanelOpen(true);
          },
        },
      ),
    [t],
  );

  // Contractor count for smart sequencing
  const contractorCountQuery = useQuery(
    trpc.contractor.list.queryOptions({ page: 1, pageSize: 1 }),
  );
  const contractorCount = (contractorCountQuery.data as { total: number } | undefined)?.total ?? 0;

  const isLoading = runsQuery.isLoading;
  const isEmpty = !isLoading && data.length === 0 && status === "all" && !dateFrom && !dateTo && cursors.length === 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold">{t("title")}</h1>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          {t("newPaymentRun")}
        </Button>
      </div>

      {isEmpty ? (
        /* Empty state with smart sequencing */
        <EmptyState
          icon={CreditCard}
          heading={te("payments.heading")}
          body={te("payments.body")}
          primaryAction={{ label: te("payments.cta"), href: "/invoices" }}
          prerequisiteMissing={contractorCount === 0}
          prerequisiteAction={{ label: te("prerequisite.cta"), href: "/contractors" }}
        />
      ) : (
        <>
          {/* Toolbar */}
          <DataTableToolbar
            activeStatus={status}
            onStatusChange={handleStatusChange}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={handleDateFromChange}
            onDateToChange={handleDateToChange}
          />

          {/* Table */}
          <PaymentRunDataTable
            data={data}
            columns={columns}
            isLoading={isLoading}
            hasNextPage={!!nextCursor}
            hasPreviousPage={cursors.length > 0}
            onNextPage={handleNextPage}
            onPreviousPage={handlePreviousPage}
            onRowClick={handleRowClick}
          />
        </>
      )}

      {/* Side panel */}
      <PaymentRunSidePanel
        runId={selectedRunId}
        open={sidePanelOpen}
        onOpenChange={(open) => {
          setSidePanelOpen(open);
          if (!open) setSelectedRunId(null);
        }}
        onImportStatement={(runId) => setBankStatementRunId(runId)}
      />

      {/* New payment run dialog */}
      <NewPaymentRunDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onViewRun={() => {
          // After dialog creates a run, refresh the list
        }}
      />

      {/* Bank statement import dialog */}
      {bankStatementRunId && (
        <BankStatementDialog
          runId={bankStatementRunId}
          open={!!bankStatementRunId}
          onOpenChange={(open) => {
            if (!open) setBankStatementRunId(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------

function PaymentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-9 w-36" />
      </div>
      {/* Chip bar skeleton */}
      <div className="flex items-center gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      {/* Table skeleton */}
      <div className="rounded-xl border bg-background">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

/**
 * Payments page at /payments.
 * Wrapped in Suspense to handle nuqs useSearchParams usage.
 */
export default function PaymentsPage() {
  return (
    <Suspense fallback={<PaymentsLoading />}>
      <PaymentsContent />
    </Suspense>
  );
}

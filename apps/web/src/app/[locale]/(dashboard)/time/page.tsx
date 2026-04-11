"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, ClipboardList, ArrowRightLeft } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { toast } from "sonner";

import { trpc } from "@/trpc/init";
import { useRouter } from "@/i18n/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { AnimateIn } from "@/components/shared/animate-in";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimeEntryStatusBadge } from "@/components/time/time-entry-status-badge";
import {
  ApprovalQueueTable,
  type TimesheetRow,
} from "@/components/time/approval-queue-table";
import { ReconciliationTable } from "@/components/time/reconciliation-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, addDays, startOfISOWeek } from "date-fns";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPeriod(weekStart: string | Date): string {
  const start =
    typeof weekStart === "string" ? new Date(weekStart) : weekStart;
  const monday = startOfISOWeek(start);
  const sunday = addDays(monday, 6);
  return `${format(monday, "MMM d")} - ${format(sunday, "MMM d")}`;
}

function minutesToDisplay(minutes: number): string {
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
}

// ---------------------------------------------------------------------------
// Inner content (uses nuqs, needs Suspense boundary)
// ---------------------------------------------------------------------------

function TimeTrackingContent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // URL state
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("pending"),
  );
  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsString.withDefault("all"),
  );

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  const pendingQuery = useQuery({
    ...trpc.time.listPending.queryOptions(),
    refetchInterval: 30000,
  });

  const allQuery = useQuery({
    ...trpc.time.listAll.queryOptions({
      ...(statusFilter !== "all"
        ? {
            status: statusFilter as
              | "DRAFT"
              | "SUBMITTED"
              | "APPROVED"
              | "REJECTED",
          }
        : {}),
    }),
    enabled: tab === "all",
    refetchInterval: 30000,
  });

  const pendingTimesheets = useMemo(
    () => (pendingQuery.data ?? []) as TimesheetRow[],
    [pendingQuery.data],
  );

  const allTimesheets = useMemo(() => {
    const data = allQuery.data as
      | { items: TimesheetRow[]; nextCursor?: string }
      | undefined;
    return data?.items ?? [];
  }, [allQuery.data]);

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [["time", "listPending"]],
    });
    void queryClient.invalidateQueries({
      queryKey: [["time", "listAll"]],
    });
  }, [queryClient]);

  const approveMutation = useMutation(
    trpc.time.approve.mutationOptions({
      onSuccess: () => {
        toast.success("Timesheet approved");
        invalidate();
      },
      onError: () => toast.error("Failed to approve timesheet"),
    }),
  );

  const rejectMutation = useMutation(
    trpc.time.reject.mutationOptions({
      onSuccess: () => {
        toast.success("Timesheet rejected");
        invalidate();
      },
      onError: () => toast.error("Failed to reject timesheet"),
    }),
  );

  const bulkApproveMutation = useMutation(
    trpc.time.bulkApprove.mutationOptions({
      onSuccess: (data) => {
        const result = data as { count: number };
        toast.success(`${result.count} timesheet(s) approved`);
        invalidate();
      },
      onError: () => toast.error("Failed to approve timesheets"),
    }),
  );

  const bulkRejectMutation = useMutation(
    trpc.time.bulkReject.mutationOptions({
      onSuccess: (data) => {
        const result = data as { count: number };
        toast.success(`${result.count} timesheet(s) rejected`);
        invalidate();
      },
      onError: () => toast.error("Failed to reject timesheets"),
    }),
  );

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleApprove = useCallback(
    (timesheetId: string) => {
      approveMutation.mutate({ timesheetId });
    },
    [approveMutation],
  );

  const handleReject = useCallback(
    (timesheetId: string, reason: string) => {
      rejectMutation.mutate({ timesheetId, reason });
    },
    [rejectMutation],
  );

  const handleBulkApprove = useCallback(
    (timesheetIds: string[]) => {
      bulkApproveMutation.mutate({ timesheetIds });
    },
    [bulkApproveMutation],
  );

  const handleBulkReject = useCallback(
    (timesheetIds: string[], reason: string) => {
      bulkRejectMutation.mutate({ timesheetIds, reason });
    },
    [bulkRejectMutation],
  );

  const handleNavigateToReview = useCallback(
    (contractorId: string, weekStartDate: string) => {
      router.push(`/time/${contractorId}?week=${weekStartDate}`);
    },
    [router],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <PageHeader title="Time Tracking" />
      </AnimateIn>

      <AnimateIn delay={1}>
        <Tabs
          value={tab}
          onValueChange={(value) => void setTab(value)}
        >
          <TabsList>
            <TabsTrigger value="pending">
              Pending Reviews
              {pendingTimesheets.length > 0 && (
                <span className="ms-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground">
                  {pendingTimesheets.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">All Entries</TabsTrigger>
            <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          </TabsList>

          {/* Tab 1: Pending Reviews */}
          <TabsContent value="pending" className="mt-4">
            {pendingQuery.isLoading ? (
              <LoadingSkeleton />
            ) : pendingTimesheets.length === 0 ? (
              <EmptyState
                icon={Clock}
                heading="No pending reviews"
                body="All timesheets have been reviewed. Check back when contractors submit new entries."
              />
            ) : (
              <ApprovalQueueTable
                timesheets={pendingTimesheets}
                onApprove={handleApprove}
                onReject={handleReject}
                onBulkApprove={handleBulkApprove}
                onBulkReject={handleBulkReject}
                onNavigateToReview={handleNavigateToReview}
              />
            )}
          </TabsContent>

          {/* Tab 2: All Entries */}
          <TabsContent value="all" className="mt-4">
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex items-center gap-3">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => void setStatusFilter(v)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SUBMITTED">Submitted</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {allQuery.isLoading ? (
                <LoadingSkeleton />
              ) : allTimesheets.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  heading="No time entries"
                  body="Time entries will appear here once contractors start logging hours."
                />
              ) : (
                <div className="rounded-xl border bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contractor</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-end">
                          Total Hours
                        </TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allTimesheets.map((ts) => (
                        <TableRow key={ts.id}>
                          <TableCell className="text-sm font-medium">
                            {ts.contractor.legalName}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatPeriod(ts.weekStartDate)}
                          </TableCell>
                          <TableCell className="text-end text-sm font-medium">
                            {minutesToDisplay(ts.totalMinutes)}
                          </TableCell>
                          <TableCell>
                            <TimeEntryStatusBadge status={ts.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab 3: Reconciliation */}
          <TabsContent value="reconciliation" className="mt-4">
            <ReconciliationTable />
          </TabsContent>
        </Tabs>
      </AnimateIn>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg border px-4 py-3"
        >
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

/**
 * Admin time tracking page at /time.
 * 3 tabs: Pending Reviews, All Entries, Reconciliation (placeholder).
 */
export default function TimePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-10 w-80" />
          <LoadingSkeleton />
        </div>
      }
    >
      <TimeTrackingContent />
    </Suspense>
  );
}

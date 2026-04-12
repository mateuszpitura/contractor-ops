"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfISOWeek, endOfMonth, format, startOfISOWeek, startOfMonth } from "date-fns";
import { Clock, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalSyncButton } from "@/components/time/external-sync-button";
import { SingleEntryForm } from "@/components/time/single-entry-form";
import { TimeEntryStatusBadge } from "@/components/time/time-entry-status-badge";
import { TimeSummaryStats } from "@/components/time/time-summary-stats";
import { TimesheetGrid } from "@/components/time/timesheet-grid";
import { TimesheetHeader } from "@/components/time/timesheet-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/trpc/init";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWeekRange(weekStart: Date | string): string {
  const d = typeof weekStart === "string" ? new Date(weekStart) : weekStart;
  const weekEnd = endOfISOWeek(d);
  return `${format(d, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
}

function minutesToHoursDisplay(minutes: number): string {
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PortalTimePage() {
  const t = useTranslations("Portal.timeTracking");
  const queryClient = useQueryClient();

  // Current week state
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfISOWeek(new Date()));
  const [singleEntryOpen, setSingleEntryOpen] = useState(false);

  const weekStartStr = format(currentWeekStart, "yyyy-MM-dd");

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  const timesheetQuery = useQuery(
    trpc.portalTime.getTimesheet.queryOptions({
      weekStartDate: weekStartStr,
    }),
  );

  const contractsQuery = useQuery(trpc.portalTime.getActiveContracts.queryOptions());

  const providersQuery = useQuery(trpc.portalTime.getConnectedProviders.queryOptions());

  const historyQuery = useQuery(trpc.portalTime.listTimesheets.queryOptions({ limit: 10 }));

  // Compute summary stats
  const currentWeekMinutes = timesheetQuery.data?.totalMinutes ?? 0;

  // Pending count from history
  const pendingCount = useMemo(() => {
    if (!historyQuery.data?.items) return 0;
    return historyQuery.data.items.filter((t) => t.status === "SUBMITTED").length;
  }, [historyQuery.data]);

  // Approved this month (rough from history data)
  const approvedMonthMinutes = useMemo(() => {
    if (!historyQuery.data?.items) return 0;
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    return historyQuery.data.items
      .filter((t) => {
        if (t.status !== "APPROVED") return false;
        const d = new Date(t.weekStartDate);
        return d >= monthStart && d <= monthEnd;
      })
      .reduce((sum, t) => sum + t.totalMinutes, 0);
  }, [historyQuery.data]);

  // Connected providers
  const connectedProviders = useMemo(() => {
    const set = new Set<string>();
    for (const p of providersQuery.data ?? []) {
      set.add(p.provider);
    }
    return set;
  }, [providersQuery.data]);

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const saveDraftMutation = useMutation(
    trpc.portalTime.saveDraftEntries.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.portalTime.getTimesheet.queryOptions({
            weekStartDate: weekStartStr,
          }).queryKey,
        });
      },
    }),
  );

  const createSingleEntryMutation = useMutation(
    trpc.portalTime.createSingleEntry.mutationOptions({
      onSuccess: () => {
        toast.success(t("toast.entryAdded"));
        setSingleEntryOpen(false);
        void queryClient.invalidateQueries({
          queryKey: trpc.portalTime.getTimesheet.queryOptions({
            weekStartDate: weekStartStr,
          }).queryKey,
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.portalTime.listTimesheets.queryOptions({ limit: 10 }).queryKey,
        });
      },
      onError: () => {
        toast.error(t("toast.entryAddFailed"));
      },
    }),
  );

  const submitMutation = useMutation(
    trpc.portalTime.submitTimesheet.mutationOptions({
      onSuccess: () => {
        toast.success(t("toast.timesheetSubmitted"));
        void queryClient.invalidateQueries({
          queryKey: trpc.portalTime.getTimesheet.queryOptions({
            weekStartDate: weekStartStr,
          }).queryKey,
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.portalTime.listTimesheets.queryOptions({ limit: 10 }).queryKey,
        });
      },
      onError: () => {
        toast.error(t("toast.timesheetSubmitFailed"));
      },
    }),
  );

  const syncMutation = useMutation(
    trpc.portalTime.syncExternal.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.portalTime.getTimesheet.queryOptions({
            weekStartDate: weekStartStr,
          }).queryKey,
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.portalTime.listTimesheets.queryOptions({ limit: 10 }).queryKey,
        });
      },
    }),
  );

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleWeekChange = useCallback((date: Date) => {
    setCurrentWeekStart(startOfISOWeek(date));
  }, []);

  const handleSubmitTimesheet = useCallback(() => {
    if (!timesheetQuery.data?.id) return;
    submitMutation.mutate({ timesheetId: timesheetQuery.data.id });
  }, [timesheetQuery.data?.id, submitMutation]);

  const handleSaveEntries = useCallback(
    (
      entries: Array<{
        id?: string;
        contractId: string;
        entryDate: string;
        minutes: number;
        description?: string;
      }>,
    ) => {
      if (!timesheetQuery.data?.id) return;
      saveDraftMutation.mutate({
        timesheetId: timesheetQuery.data.id,
        entries,
      });
    },
    [timesheetQuery.data?.id, saveDraftMutation],
  );

  const handleSingleEntry = useCallback(
    (entry: { contractId: string; entryDate: string; minutes: number; description?: string }) => {
      createSingleEntryMutation.mutate(entry);
    },
    [createSingleEntryMutation],
  );

  const handleSync = useCallback(
    (provider: "CLOCKIFY" | "JIRA") => async (startDate: string, endDate: string) => {
      const result = await syncMutation.mutateAsync({
        provider,
        startDate,
        endDate,
      });
      return result;
    },
    [syncMutation],
  );

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  const isLoading = timesheetQuery.isPending || contractsQuery.isPending;

  const timesheet = timesheetQuery.data;
  const contracts = contractsQuery.data ?? [];
  const timesheetStatus = (timesheet?.status ?? "DRAFT") as
    | "DRAFT"
    | "SUBMITTED"
    | "APPROVED"
    | "REJECTED";
  const isDisabled = timesheetStatus === "SUBMITTED" || timesheetStatus === "APPROVED";

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      {/* 1. Summary stats */}
      <TimeSummaryStats
        currentWeekMinutes={currentWeekMinutes}
        pendingCount={pendingCount}
        approvedMonthMinutes={approvedMonthMinutes}
        isLoading={isLoading}
      />

      {/* 2. Timesheet header */}
      {isLoading ? (
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
      ) : (
        <TimesheetHeader
          weekStartDate={currentWeekStart}
          status={timesheetStatus}
          totalMinutes={timesheet?.totalMinutes ?? 0}
          onWeekChange={handleWeekChange}
          onSubmit={handleSubmitTimesheet}
          isSubmitting={submitMutation.isPending}
        />
      )}

      {/* 3. Timesheet grid */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <TimesheetGrid
          weekStartDate={currentWeekStart}
          entries={timesheet?.entries ?? []}
          contracts={contracts}
          timesheetId={timesheet?.id ?? ""}
          disabled={isDisabled}
          rejectionReason={
            timesheetStatus === "REJECTED"
              ? ((timesheet as Record<string, unknown>)?.rejectionReason as string | null)
              : null
          }
          onSave={handleSaveEntries}
        />
      )}

      {/* 4. Add Entry button */}
      {!isDisabled && (
        <Button variant="outline" onClick={() => setSingleEntryOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("addEntry")}
        </Button>
      )}

      {/* 5. External sync buttons */}
      {(connectedProviders.has("CLOCKIFY") || connectedProviders.has("JIRA")) && (
        <div className="flex flex-wrap gap-3">
          {connectedProviders.has("CLOCKIFY") && (
            <ExternalSyncButton
              provider="CLOCKIFY"
              connected={true}
              onSync={handleSync("CLOCKIFY")}
              isSyncing={syncMutation.isPending && syncMutation.variables?.provider === "CLOCKIFY"}
            />
          )}
          {connectedProviders.has("JIRA") && (
            <ExternalSyncButton
              provider="JIRA"
              connected={true}
              onSync={handleSync("JIRA")}
              isSyncing={syncMutation.isPending && syncMutation.variables?.provider === "JIRA"}
            />
          )}
        </div>
      )}

      {/* 6. Time entry history */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{t("pastTimesheets")}</h2>
        {historyQuery.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`skel-${i}`} className="h-10 w-full" />
            ))}
          </div>
        ) : !historyQuery.data?.items || historyQuery.data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 font-display text-[20px] font-semibold">{t("noEntriesHeading")}</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {t("noEntriesBody")}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.period")}</TableHead>
                <TableHead>{t("columns.totalHours")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead>{t("columns.submitted")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyQuery.data.items.map((ts) => (
                <TableRow
                  key={ts.id}
                  className="cursor-pointer"
                  onClick={() => {
                    const d = new Date(ts.weekStartDate);
                    setCurrentWeekStart(startOfISOWeek(d));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <TableCell className="font-medium">{formatWeekRange(ts.weekStartDate)}</TableCell>
                  <TableCell>{minutesToHoursDisplay(ts.totalMinutes)}</TableCell>
                  <TableCell>
                    <TimeEntryStatusBadge
                      status={ts.status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ts.submittedAt
                      ? format(new Date(ts.submittedAt as unknown as string), "MMM d, yyyy")
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Single entry dialog */}
      <SingleEntryForm
        open={singleEntryOpen}
        onOpenChange={setSingleEntryOpen}
        contracts={contracts}
        onSubmit={handleSingleEntry}
        isSubmitting={createSingleEntryMutation.isPending}
      />
    </div>
  );
}

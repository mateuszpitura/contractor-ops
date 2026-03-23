"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, ClipboardCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, parseAsInteger, useQueryState } from "nuqs";
import { toast } from "sonner";

import { trpc } from "@/trpc/init";
import { usePermissions } from "@/hooks/use-permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  getColumns,
  type ApprovalQueueRow,
} from "@/components/approvals/approval-queue/columns";
import { ApprovalQueueTable } from "@/components/approvals/approval-queue/data-table";
import { ApprovalQueueToolbar } from "@/components/approvals/approval-queue/data-table-toolbar";
import { ApprovalSidePanel } from "@/components/approvals/approval-queue/side-panel";

// ---------------------------------------------------------------------------
// Inner content (uses nuqs, needs Suspense boundary)
// ---------------------------------------------------------------------------

function ApprovalsContent() {
  const t = useTranslations("Approvals");
  const te = useTranslations("EmptyStates");
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  // URL state via nuqs
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("my"),
  );
  const [status, setStatus] = useQueryState(
    "status",
    parseAsString.withDefault("all"),
  );
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1),
  );
  const [pageSize, setPageSize] = useQueryState(
    "pageSize",
    parseAsInteger.withDefault(10),
  );

  // Side panel state
  const [selectedStep, setSelectedStep] = useState<ApprovalQueueRow | null>(
    null,
  );
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

  // Admin-only "All" tab visibility
  const isAdmin = can("settings", ["read"]);

  // Build query input
  const queryInput = useMemo(
    () => ({
      tab: tab as "my" | "all",
      status: status as "all" | "pending" | "overdue" | "approved" | "rejected",
      search: search || undefined,
      page,
      pageSize,
      sortBy: "slaDeadline" as const,
      sortOrder: "asc" as const,
    }),
    [tab, status, search, page, pageSize],
  );

  // Fetch queue data
  const queueQuery = useQuery({
    ...trpc.approval.listPending.queryOptions(queryInput),
    refetchInterval: 30000,
  });

  const data = useMemo(() => {
    const result = queueQuery.data as
      | { items: ApprovalQueueRow[]; total: number; page: number; pageSize: number }
      | undefined;
    return result?.items ?? [];
  }, [queueQuery.data]);

  const totalRows = useMemo(() => {
    const result = queueQuery.data as
      | { items: unknown[]; total: number }
      | undefined;
    return result?.total ?? 0;
  }, [queueQuery.data]);

  const pageCount = Math.ceil(totalRows / pageSize);

  // Inline approve mutation
  const approveMutation = useMutation(
    trpc.approval.approve.mutationOptions({
      onSuccess: () => {
        toast.success(t("toast.approved"));
        void queryClient.invalidateQueries({
          queryKey: [["approval", "listPending"]],
        });
      },
      onError: () => {
        toast.error(t("errors.failedToApprove"));
      },
    }),
  );

  // Inline reject mutation
  const rejectMutation = useMutation(
    trpc.approval.reject.mutationOptions({
      onSuccess: () => {
        toast.success(t("toast.rejected"));
        void queryClient.invalidateQueries({
          queryKey: [["approval", "listPending"]],
        });
      },
      onError: () => {
        toast.error(t("errors.failedToReject"));
      },
    }),
  );

  // Column definitions with action callbacks
  const columns = useMemo(
    () =>
      getColumns(
        (key: string) => t(key as Parameters<typeof t>[0]),
        {
          onApprove: (stepId) => approveMutation.mutate({ stepId }),
          onReject: (stepId, comment) =>
            rejectMutation.mutate({ stepId, comment }),
        },
      ),
    [t, approveMutation, rejectMutation],
  );

  // Row click handler for side panel
  const handleRowClick = useCallback((row: ApprovalQueueRow) => {
    setSelectedStep(row);
    setSidePanelOpen(true);
  }, []);

  // Pagination handlers
  const handlePageChange = useCallback(
    (newPage: number) => void setPage(newPage),
    [setPage],
  );

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      void setPageSize(newSize);
      void setPage(1);
    },
    [setPageSize, setPage],
  );

  // Status filter handler
  const handleStatusChange = useCallback(
    (newStatus: string) => {
      void setStatus(newStatus);
      void setPage(1);
    },
    [setStatus, setPage],
  );

  // Search handler
  const handleSearchChange = useCallback(
    (value: string) => {
      void setSearch(value);
      void setPage(1);
    },
    [setSearch, setPage],
  );

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Clear selection when tab, status, search, or page changes
  useEffect(() => {
    setSelectedIds([]);
  }, [tab, status, search, page]);

  const isLoading = queueQuery.isLoading;
  const isEmpty = !isLoading && data.length === 0;

  // Render queue content (shared between tabs)
  const renderQueue = () => {
    if (isEmpty && status === "all" && !search) {
      // True empty state - informational only, no CTA
      return (
        <EmptyState
          icon={CheckSquare}
          heading={te("approvals.heading")}
          body={te("approvals.body")}
        />
      );
    }

    return (
      <div className="space-y-4">
        <ApprovalQueueToolbar
          activeStatus={status}
          onStatusChange={handleStatusChange}
          search={search}
          onSearchChange={handleSearchChange}
          isSearching={queueQuery.isFetching && !isLoading}
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds([])}
        />
        <ApprovalQueueTable
          data={data}
          columns={columns}
          pageCount={pageCount}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onRowClick={handleRowClick}
          onSelectionChange={setSelectedIds}
          isLoading={isLoading}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <h1 className="text-[20px] font-semibold">{t("pageTitle")}</h1>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(value) => {
          void setTab(value);
          void setPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="my">{t("tabMy")}</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="all">{t("tabAll")}</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="my" className="mt-4">
          {renderQueue()}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="all" className="mt-4">
            {renderQueue()}
          </TabsContent>
        )}
      </Tabs>

      {/* Side panel */}
      <ApprovalSidePanel
        step={sidePanelOpen ? selectedStep : null}
        open={sidePanelOpen}
        onOpenChange={(open) => {
          setSidePanelOpen(open);
          if (!open) setSelectedStep(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------

function ApprovalsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-10 w-60" />
      <div className="flex items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-9 w-80" />
      <div className="rounded-xl border bg-background">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0"
          >
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
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
 * Approvals queue page at /approvals.
 * Wrapped in Suspense to handle nuqs useSearchParams usage.
 */
export default function ApprovalsPage() {
  return (
    <Suspense fallback={<ApprovalsLoading />}>
      <ApprovalsContent />
    </Suspense>
  );
}

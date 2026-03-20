"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { GitBranch, Plus } from "lucide-react";

import { trpc } from "@/trpc/init";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { TemplatePicker } from "@/components/workflows/template-picker-dialog";

// ---------------------------------------------------------------------------
// Run status badge styling (matching UI-SPEC)
// ---------------------------------------------------------------------------

const runStatusBadgeColors: Record<string, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground border border-border",
  IN_PROGRESS: "bg-primary/10 text-primary",
  COMPLETED: "bg-green-500/10 text-green-600 dark:text-green-400",
  CANCELLED: "bg-muted text-muted-foreground border border-border",
  BLOCKED: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  OVERDUE: "bg-destructive/10 text-destructive",
};

// ---------------------------------------------------------------------------
// Row type matching tRPC response
// ---------------------------------------------------------------------------

type WorkflowRunRow = {
  id: string;
  status: string;
  startedAt: string | null;
  workflowTemplate: {
    name: string;
    type: string;
  } | null;
  progress: {
    done: number;
    total: number;
    percent: number;
  };
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type WorkflowsTabProps = {
  contractorId: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkflowsTab({ contractorId }: WorkflowsTabProps) {
  const t = useTranslations("Workflows");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const runsQuery = useQuery(
    trpc.workflow.listRuns.queryOptions({
      contractorId,
      page,
      pageSize,
      sortBy: "startedAt",
      sortOrder: "desc",
    }),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryData = runsQuery.data as any;
  const items: WorkflowRunRow[] = useMemo(
    () => queryData?.items ?? [],
    [queryData],
  );
  const totalCount: number = queryData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Loading state
  if (runsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (items.length === 0 && !runsQuery.isLoading) {
    return (
      <>
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
          <GitBranch className="size-10 text-muted-foreground/50" />
          <h4 className="text-sm font-medium">
            {t("contractorNoWorkflows")}
          </h4>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("contractorNoWorkflowsBody")}
          </p>
          <Button size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="mr-1.5 size-3.5" />
            {t("contractorNoWorkflowsCta")}
          </Button>
        </div>
        <TemplatePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          contractorId={contractorId}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with CTA */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">
          {t("contractorWorkflowsTab")}
        </h3>
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="mr-1.5 size-3.5" />
          {t("contractorStartWorkflow")}
        </Button>
      </div>

      {/* Runs list */}
      <div className="space-y-2">
        {items.map((run) => (
          <Link
            key={run.id}
            href={`/workflows/${run.id}`}
            className="flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {run.workflowTemplate?.name ?? "Workflow"}
              </p>
            </div>
            <Badge
              variant="secondary"
              className={runStatusBadgeColors[run.status] ?? ""}
            >
              {t(
                `runStatus.${run.status}` as Parameters<typeof t>[0],
              )}
            </Badge>
            <span className="text-sm tabular-nums text-muted-foreground">
              {run.progress.done}/{run.progress.total}
            </span>
            {run.startedAt && (
              <span className="text-sm text-muted-foreground">
                {new Date(run.startedAt).toLocaleDateString("pl-PL")}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Simple pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            &laquo;
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            &raquo;
          </Button>
        </div>
      )}

      {/* Template picker dialog */}
      <TemplatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        contractorId={contractorId}
      />
    </div>
  );
}

"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBreadcrumbOverride } from "@/components/layout/breadcrumb-context";
import { Link } from "@/i18n/navigation";

import { RunHeader } from "@/components/workflows/workflow-run/run-header";
import { TaskChecklist } from "@/components/workflows/workflow-run/task-checklist";

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function RunDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-2 w-full" />
      </div>
      {/* Task checklist skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-16" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <Skeleton className="size-5 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function WorkflowRunDetailPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations("Workflows");

  const session = authClient.useSession();
  const currentUserId = session?.data?.user?.id ?? null;

  const runQuery = useQuery(
    trpc.workflow.getRun.queryOptions({ id: params.id }),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = runQuery.data as any;

  useBreadcrumbOverride(params.id, run?.workflowTemplate?.name);

  // Error states
  if (runQuery.isError) {
    const isNotFound =
      runQuery.error?.message?.includes("not found") ||
      (runQuery.error as { data?: { code?: string } })?.data?.code ===
        "NOT_FOUND";

    if (isNotFound) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
          <h2 className="text-lg font-medium">{t("notFound")}</h2>
          <Button variant="outline" render={<Link href="/workflows" />}>
            {t("backToWorkflows")}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <h2 className="text-lg font-medium">
          {t("errors.failedToLoadWorkflowDetail")}
        </h2>
        <Button variant="outline" onClick={() => runQuery.refetch()}>
          {t("errors.retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Content */}
      {runQuery.isLoading || !run ? (
        <RunDetailSkeleton />
      ) : (
        <>
          <RunHeader run={run} />
          <TaskChecklist
            tasks={run.tasks}
            runId={run.id}
            currentUserId={currentUserId}
          />
        </>
      )}
    </div>
  );
}

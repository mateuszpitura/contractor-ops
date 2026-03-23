"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitBranch } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";

import { trpc } from "@/trpc/init";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { Link } from "@/i18n/navigation";

import { WorkflowRunsDataTable } from "@/components/workflows/workflow-runs-table/data-table";
import type { WorkflowRunRow } from "@/components/workflows/workflow-runs-table/columns";
import { WorkflowSidePanel } from "@/components/workflows/workflow-side-panel";
import { MyTasksList } from "@/components/workflows/my-tasks-list";
import { TemplatesTable } from "@/components/workflows/templates-table";
import { TemplatePicker } from "@/components/workflows/template-picker-dialog";

// ---------------------------------------------------------------------------
// Inner content (uses nuqs, needs Suspense)
// ---------------------------------------------------------------------------

function WorkflowsContent() {
  const t = useTranslations("Workflows");
  const { can } = usePermissions();

  // Tab state synced to URL
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsString.withDefault("runs"),
  );

  // Side panel state
  const [selectedRun, setSelectedRun] = useState<WorkflowRunRow | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

  // Template picker state
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  const handleRowClick = (run: WorkflowRunRow) => {
    setSelectedRun(run);
    setSidePanelOpen(true);
  };

  const handleStartWorkflow = () => {
    setTemplatePickerOpen(true);
  };

  // Count queries for empty state detection
  const runsCountQuery = useQuery(
    trpc.workflow.listRuns.queryOptions({ page: 1, pageSize: 1 }),
  );
  const contractorCountQuery = useQuery(
    trpc.contractor.list.queryOptions({ page: 1, pageSize: 1 }),
  );
  const runsTotal = (runsCountQuery.data as { total: number } | undefined)?.total ?? 0;
  const contractorCount = (contractorCountQuery.data as { total: number } | undefined)?.total ?? 0;
  const isCountLoading = runsCountQuery.isLoading;

  const canManageTemplates = can("workflow", ["create"]);

  // Show empty state when no workflow runs exist
  if (!isCountLoading && runsTotal === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-semibold">{t("pageTitle")}</h1>
          <Button size="sm" onClick={handleStartWorkflow}>
            {t("startWorkflow")}
          </Button>
        </div>
        <EmptyState
          icon={GitBranch}
          heading="No workflows yet"
          body="Create a workflow template to automate onboarding and offboarding tasks."
          primaryAction={{ label: "Create template", onClick: handleStartWorkflow }}
          prerequisiteMissing={contractorCount === 0}
          prerequisiteAction={{ label: "Add contractor", href: "/contractors" }}
        />
        <TemplatePicker
          open={templatePickerOpen}
          onOpenChange={setTemplatePickerOpen}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold">{t("pageTitle")}</h1>
        <Button size="sm" onClick={handleStartWorkflow}>
          {t("startWorkflow")}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(value) => void setTab(value)}
      >
        <TabsList>
          <TabsTrigger value="runs">{t("tabRuns")}</TabsTrigger>
          <TabsTrigger value="tasks">{t("tabMyTasks")}</TabsTrigger>
          {canManageTemplates && (
            <TabsTrigger value="templates">{t("tabTemplates")}</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="runs" className="mt-4">
          <WorkflowRunsDataTable
            onRowClick={handleRowClick}
            onStartWorkflow={handleStartWorkflow}
          />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <MyTasksList />
        </TabsContent>

        {canManageTemplates && (
          <TabsContent value="templates" className="mt-4">
            <div className="flex items-center justify-end mb-4">
              <Button
                size="sm"
                render={<Link href="/workflows/templates/new" />}
              >
                {t("templates.newTemplate")}
              </Button>
            </div>
            <TemplatesTable />
          </TabsContent>
        )}
      </Tabs>

      {/* Side panel */}
      <WorkflowSidePanel
        runId={sidePanelOpen && selectedRun ? selectedRun.id : null}
        onClose={() => {
          setSidePanelOpen(false);
          setSelectedRun(null);
        }}
      />

      {/* Template picker dialog */}
      <TemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------

function WorkflowsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-10 w-80" />
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="rounded-xl border bg-background">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0"
            >
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

/**
 * Workflow list page at /workflows.
 * Wrapped in Suspense to handle nuqs useSearchParams usage.
 */
export default function WorkflowsPage() {
  return (
    <Suspense fallback={<WorkflowsLoading />}>
      <WorkflowsContent />
    </Suspense>
  );
}

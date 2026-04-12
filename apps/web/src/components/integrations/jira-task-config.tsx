"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/trpc/init";
import { JiraProjectMappingDialog } from "./jira-project-mapping-dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskConfig {
  jiraEnabled: boolean;
  jiraProjectId?: string;
  jiraProjectKey?: string;
  jiraProjectName?: string;
  jiraIssueTypeId?: string;
  jiraIssueTypeName?: string;
}

interface JiraTaskConfigProps {
  taskTemplateId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JiraTaskConfig({ taskTemplateId }: JiraTaskConfigProps) {
  const t = useTranslations("Integrations.jira.taskConfig");
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [jiraEnabled, setJiraEnabled] = useState(false);

  // Check if Jira is connected
  const connectionQuery = useQuery({
    ...trpc.jira.connectionStatus.queryOptions(),
    staleTime: Infinity,
  });

  const connection = connectionQuery.data;

  // Fetch task config
  const configQuery = useQuery({
    ...trpc.jira.getTaskConfig.queryOptions({ taskTemplateId }),
    enabled: !!connection,
  });

  const config = configQuery.data as TaskConfig | undefined;

  // Sync local toggle state with server data
  useEffect(() => {
    if (config) {
      setJiraEnabled(config.jiraEnabled ?? false);
    }
  }, [config]);

  // Save mutation for toggle
  const saveMutation = useMutation({
    ...trpc.jira.saveTaskConfig.mutationOptions(),
    onSuccess: () => {
      toast.success(t("configSaved"));
      queryClient.invalidateQueries({
        queryKey: trpc.jira.getTaskConfig.queryKey({ taskTemplateId }),
      });
    },
    onError: () => {
      toast.error(t("configSaveFailed"));
      // Revert toggle
      setJiraEnabled(config?.jiraEnabled ?? false);
    },
  });

  // Don't render if Jira is not connected
  if (!connection) return null;

  const hasMappingConfigured = !!(config?.jiraProjectId && config?.jiraIssueTypeId);
  const mappingSummary =
    hasMappingConfigured && config?.jiraProjectName && config?.jiraIssueTypeName
      ? `${config.jiraProjectName} / ${config.jiraIssueTypeName}`
      : t("notConfigured");

  function handleToggle(checked: boolean) {
    if (!hasMappingConfigured) return;
    setJiraEnabled(checked);
    saveMutation.mutate({
      taskTemplateId,
      config: {
        jiraEnabled: checked,
        jiraProjectId: config?.jiraProjectId,
        jiraProjectKey: config?.jiraProjectKey,
        jiraProjectName: config?.jiraProjectName,
        jiraIssueTypeId: config?.jiraIssueTypeId,
        jiraIssueTypeName: config?.jiraIssueTypeName,
      },
    });
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Switch */}
        <div className="flex items-center gap-2">
          <Switch
            id={`jira-toggle-${taskTemplateId}`}
            checked={jiraEnabled}
            onCheckedChange={handleToggle}
            disabled={!hasMappingConfigured || saveMutation.isPending}
          />
          <Label htmlFor={`jira-toggle-${taskTemplateId}`} className="cursor-pointer text-sm">
            {t("enableToggle")}
          </Label>
        </div>

        {/* Mapping summary */}
        <span className={`flex-1 text-sm ${hasMappingConfigured ? "" : "text-muted-foreground"}`}>
          {mappingSummary}
        </span>

        {/* Configure button */}
        <Button variant="ghost" size="sm" onClick={() => setDialogOpen(true)}>
          {t("configure")}
        </Button>
      </div>

      {/* Mapping dialog */}
      <JiraProjectMappingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        taskTemplateId={taskTemplateId}
        connectionId={connection.id}
      />
    </>
  );
}

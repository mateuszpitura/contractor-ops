import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface TaskConfig {
  jiraEnabled: boolean;
  jiraProjectId?: string;
  jiraProjectKey?: string;
  jiraProjectName?: string;
  jiraIssueTypeId?: string;
  jiraIssueTypeName?: string;
}

export function useJiraTaskConfig(taskTemplateId: string) {
  const trpc = useTRPC();
  const t = useTranslations('Integrations.jira.taskConfig');
  const queryClient = useQueryClient();
  const [jiraEnabled, setJiraEnabled] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openConfigureDialog = () => setDialogOpen(true);

  const connectionQuery = useQuery({
    ...trpc.jira.connectionStatus.queryOptions(),
    staleTime: Infinity,
  });

  const connection = connectionQuery.data;

  const configQuery = useQuery({
    ...trpc.jira.getTaskConfig.queryOptions({ taskTemplateId }),
    enabled: !!connection,
  });

  const config = configQuery.data as TaskConfig | undefined;

  useEffect(() => {
    if (config) {
      setJiraEnabled(config.jiraEnabled ?? false);
    }
  }, [config]);

  const saveMutation = useMutation({
    ...trpc.jira.saveTaskConfig.mutationOptions(),
    onSuccess: () => {
      toast.success(t('configSaved'));
      queryClient.invalidateQueries({
        queryKey: trpc.jira.getTaskConfig.queryKey({ taskTemplateId }),
      });
    },
    onError: () => {
      toast.error(t('configSaveFailed'));
      setJiraEnabled(config?.jiraEnabled ?? false);
    },
  });

  const hasMappingConfigured = !!(config?.jiraProjectId && config?.jiraIssueTypeId);
  const mappingSummary =
    hasMappingConfigured && config?.jiraProjectName && config?.jiraIssueTypeName
      ? `${config.jiraProjectName} / ${config.jiraIssueTypeName}`
      : t('notConfigured');

  const handleToggle = (checked: boolean) => {
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
  };

  return {
    taskTemplateId,
    connection,
    config,
    jiraEnabled,
    hasMappingConfigured,
    mappingSummary,
    handleToggle,
    saveMutation,
    dialogOpen,
    setDialogOpen,
    openConfigureDialog,
    t,
  } as const;
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export interface UseJiraProjectMappingDialogParams {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTemplateId: string;
  connectionId: string;
}

export interface TaskConfig {
  jiraEnabled: boolean;
  jiraProjectId?: string;
  jiraProjectKey?: string;
  jiraProjectName?: string;
  jiraIssueTypeId?: string;
  jiraIssueTypeName?: string;
}

export function useJiraProjectMappingDialog({
  open,
  onOpenChange,
  taskTemplateId,
  connectionId,
}: UseJiraProjectMappingDialogParams) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Integrations');

  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [projectKey, setProjectKey] = useState<string | undefined>(undefined);
  const [projectName, setProjectName] = useState<string | undefined>(undefined);
  const [issueTypeId, setIssueTypeId] = useState<string | undefined>(undefined);
  const [issueTypeName, setIssueTypeName] = useState<string | undefined>(undefined);
  const [jiraEnabled, setJiraEnabled] = useState(false);
  const [initialConfig, setInitialConfig] = useState<TaskConfig | null>(null);

  const configQuery = useQuery({
    ...trpc.jira.getTaskConfig.queryOptions({ taskTemplateId }),
    enabled: open,
  });

  useEffect(() => {
    if (configQuery.data) {
      const config = configQuery.data as TaskConfig;
      setProjectId(config.jiraProjectId);
      setProjectKey(config.jiraProjectKey);
      setProjectName(config.jiraProjectName);
      setIssueTypeId(config.jiraIssueTypeId);
      setIssueTypeName(config.jiraIssueTypeName);
      setJiraEnabled(config.jiraEnabled ?? false);
      setInitialConfig(config);
    }
  }, [configQuery.data]);

  const projectsQuery = useQuery({
    ...trpc.jira.listProjects.queryOptions({ connectionId }),
    enabled: open,
  });
  const projects = (projectsQuery.data ?? []) as Array<{
    id: string;
    key: string;
    name: string;
  }>;

  const issueTypesQuery = useQuery({
    ...trpc.jira.listIssueTypes.queryOptions({
      connectionId,
      projectId: projectId ?? '',
    }),
    enabled: !!projectId,
  });
  const issueTypes = (issueTypesQuery.data ?? []) as Array<{
    id: string;
    name: string;
  }>;

  const saveMutation = useMutation({
    ...trpc.jira.saveTaskConfig.mutationOptions(),
    onSuccess: () => {
      toast.success(t('jira.projectMapping.toast.saved'));
      queryClient.invalidateQueries({
        queryKey: trpc.jira.getTaskConfig.queryKey({ taskTemplateId }),
      });
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t('jira.projectMapping.toast.saveFailed'));
    },
  });

  const hasChanges = useMemo(() => {
    if (!initialConfig) return true;
    return (
      projectId !== initialConfig.jiraProjectId ||
      issueTypeId !== initialConfig.jiraIssueTypeId ||
      jiraEnabled !== initialConfig.jiraEnabled
    );
  }, [projectId, issueTypeId, jiraEnabled, initialConfig]);

  const handleProjectChange = (value: string | null) => {
    if (!value) return;
    const project = projects.find(p => p.id === value);
    if (project) {
      setProjectId(project.id);
      setProjectKey(project.key);
      setProjectName(project.name);
      setIssueTypeId(undefined);
      setIssueTypeName(undefined);
    }
  };

  const handleIssueTypeChange = (value: string | null) => {
    if (!value) return;
    const issueType = issueTypes.find(it => it.id === value);
    if (issueType) {
      setIssueTypeId(issueType.id);
      setIssueTypeName(issueType.name);
    }
  };

  const handleSave = () => {
    saveMutation.mutate({
      taskTemplateId,
      config: {
        jiraEnabled,
        jiraProjectId: projectId,
        jiraProjectKey: projectKey,
        jiraProjectName: projectName,
        jiraIssueTypeId: issueTypeId,
        jiraIssueTypeName: issueTypeName,
      },
    });
  };

  return {
    open,
    onOpenChange,
    projectId,
    issueTypeId,
    jiraEnabled,
    setJiraEnabled,
    projectsQuery,
    projects,
    issueTypesQuery,
    issueTypes,
    hasChanges,
    handleProjectChange,
    handleIssueTypeChange,
    handleSave,
    saveMutation,
    t,
  } as const;
}

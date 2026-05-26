import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { WORKFLOW_STATUSES } from '../status-mapping.constants.js';

export { WORKFLOW_STATUSES };

export interface MappingEntry {
  workflowStatus: string;
  jiraTransitionId: string;
  jiraTransitionName: string;
  jiraTargetStatusName: string;
  jiraTargetStatusCategory: 'new' | 'indeterminate' | 'done';
}

export interface UseJiraStatusMappingDialogParams {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
}

export function useJiraStatusMappingDialog({
  open,
  onOpenChange,
  connectionId,
}: UseJiraStatusMappingDialogParams) {
  const trpc = useTRPC();
  const t = useTranslations('Integrations.jira.statusMapping');
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [mappings, setMappings] = useState<MappingEntry[]>([]);
  const [initialMappings, setInitialMappings] = useState<MappingEntry[]>([]);

  const projectsQuery = useQuery({
    ...trpc.jira.listProjects.queryOptions({ connectionId }),
    enabled: open,
  });
  const projects = (projectsQuery.data ?? []) as Array<{
    id: string;
    key: string;
    name: string;
  }>;

  const statusesQuery = useQuery({
    ...trpc.jira.listProjectStatuses.queryOptions({
      connectionId,
      projectId: selectedProjectId ?? '',
    }),
    enabled: !!selectedProjectId,
  });
  const jiraStatuses = (statusesQuery.data ?? []) as Array<{
    id: string;
    name: string;
    statusCategory: { key: string; name: string };
  }>;

  const existingMappingQuery = useQuery({
    ...trpc.jira.getStatusMapping.queryOptions({
      connectionId,
      projectId: selectedProjectId ?? '',
    }),
    enabled: !!selectedProjectId,
  });

  useEffect(() => {
    if (existingMappingQuery.data) {
      const serverMappings = existingMappingQuery.data as MappingEntry[];
      setMappings([...serverMappings]);
      setInitialMappings([...serverMappings]);
    } else if (selectedProjectId) {
      setMappings([]);
      setInitialMappings([]);
    }
  }, [existingMappingQuery.data, selectedProjectId]);

  const saveMutation = useMutation({
    ...trpc.jira.saveStatusMapping.mutationOptions(),
    onSuccess: () => {
      toast.success(t('toast.saved'));
      queryClient.invalidateQueries({
        queryKey: trpc.jira.getStatusMapping.queryKey({
          connectionId,
          projectId: selectedProjectId ?? '',
        }),
      });
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t('toast.saveFailed'));
    },
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const hasChanges = useMemo(() => {
    if (mappings.length !== initialMappings.length) return true;
    return mappings.some((m, i) => {
      const initial = initialMappings[i];
      if (!initial) return true;
      return (
        m.workflowStatus !== initial.workflowStatus ||
        m.jiraTransitionId !== initial.jiraTransitionId
      );
    });
  }, [mappings, initialMappings]);

  const handleStatusSelect = (workflowStatus: string, jiraStatusId: string) => {
    const jiraStatus = jiraStatuses.find(s => s.id === jiraStatusId);
    if (!jiraStatus) return;

    setMappings(prev => {
      const existing = prev.findIndex(m => m.workflowStatus === workflowStatus);
      const entry: MappingEntry = {
        workflowStatus,
        jiraTransitionId: jiraStatus.id,
        jiraTransitionName: jiraStatus.name,
        jiraTargetStatusName: jiraStatus.name,
        jiraTargetStatusCategory: jiraStatus.statusCategory.key as 'new' | 'indeterminate' | 'done',
      };
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = entry;
        return next;
      }
      return [...prev, entry];
    });
  };

  const handleSave = () => {
    if (!selectedProjectId) return;
    saveMutation.mutate({
      connectionId,
      projectId: selectedProjectId,
      mappings,
    });
  };

  const getMappedJiraStatusId = (workflowStatus: string): string | undefined => {
    return mappings.find(m => m.workflowStatus === workflowStatus)?.jiraTransitionId;
  };

  return {
    open,
    onOpenChange,
    selectedProjectId,
    setSelectedProjectId,
    projectsQuery,
    projects,
    statusesQuery,
    jiraStatuses,
    selectedProject,
    hasChanges,
    handleStatusSelect,
    handleSave,
    getMappedJiraStatusId,
    saveMutation,
    t,
  } as const;
}

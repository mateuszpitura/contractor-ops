import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import { useRouter } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useWorkflowMyTasks(overdueOnly: boolean) {
  const trpc = useTRPC();

  const tasksQuery = useQuery(
    trpc.workflow.myTasks.queryOptions({
      page: 1,
      pageSize: 50,
      overdueOnly: overdueOnly || undefined,
    }),
  );

  const handleRetry = useCallback(() => {
    void tasksQuery.refetch();
  }, [tasksQuery]);

  return {
    ...tasksQuery,
    handleRetry,
  } as const;
}

export function useWorkflowOverdueCount() {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.workflow.overdueCount.queryOptions(),
    refetchInterval: 60_000,
  });
}

export function useWorkflowTemplateForm(
  templateId?: string,
  options?: { onUpdateSuccess?: () => void },
) {
  const t = useTranslations('Workflows');
  const router = useRouter();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const isEditing = !!templateId;

  const templateQuery = useQuery(
    trpc.workflow.getTemplate.queryOptions({ id: templateId ?? '' }, { enabled: isEditing }),
  );

  const createMutation = useMutation(
    trpc.workflow.createTemplate.mutationOptions({
      onSuccess: () => {
        toast.success(t('toastTemplateSaved'));
        queryClient.invalidateQueries({ queryKey: ['workflow'] });
        router.push('/workflows');
      },
      onError: () => {
        toast.error(t('errorSaveTemplate'));
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.workflow.updateTemplate.mutationOptions({
      onSuccess: () => {
        toast.success(t('toastTemplateSaved'));
        queryClient.invalidateQueries({ queryKey: ['workflow'] });
        options?.onUpdateSuccess?.();
      },
      onError: () => {
        toast.error(t('errorSaveTemplate'));
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.workflow.deleteTemplate.mutationOptions({
      onSuccess: () => {
        toast.success(t('toastTemplateDeleted'));
        queryClient.invalidateQueries({ queryKey: ['workflow'] });
        router.push('/workflows');
      },
      onError: err => toast.error(err.message),
    }),
  );

  const duplicateMutation = useMutation(
    trpc.workflow.duplicateTemplate.mutationOptions({
      onSuccess: data => {
        toast.success(t('toastTemplateDuplicated'));
        queryClient.invalidateQueries({ queryKey: ['workflow'] });
        router.push(`/workflows/templates/${(data as Record<string, unknown>).id}`);
      },
      onError: err => toast.error(err.message),
    }),
  );

  return {
    templateQuery,
    createMutation,
    updateMutation,
    deleteMutation,
    duplicateMutation,
    isEditing,
  } as const;
}

export function useWorkflowTemplateBuilderUsers(enabled: boolean) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.user.list.queryOptions(),
    enabled,
  });
}

export function useWorkflowTemplatesList(page: number, pageSize = 25) {
  const trpc = useTRPC();

  const templatesQuery = useQuery(
    trpc.workflow.listTemplates.queryOptions({
      page,
      pageSize,
    }),
  );

  const handleRetry = useCallback(() => {
    void templatesQuery.refetch();
  }, [templatesQuery]);

  return {
    ...templatesQuery,
    handleRetry,
  } as const;
}

export function useWorkflowSeedStarterTemplates() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflow.seedStarterTemplates.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.workflow.pathFilter());
      },
    }),
  );
}

export function useWorkflowTemplatePicker(open: boolean, search: string) {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.workflow.listTemplates.queryOptions({
      page: 1,
      pageSize: 50,
      status: ['ACTIVE'],
      search: search.length >= 2 ? search : undefined,
    }),
    enabled: open,
  });
}

export function useWorkflowSuggestedTemplate(contractorId: string | undefined, enabled: boolean) {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.workflowRoles.selectForContractor.queryOptions({ contractorId: contractorId ?? '' }),
    enabled,
  });
}

export function useWorkflowStartRun() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflow.startRun.mutationOptions({
      onError: err => toast.error(err.message),
      onSuccess: () => {
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.workflow.pathFilter());
      },
    }),
  );
}

export function useWorkflowRunPermissions() {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.authPermissions.getCurrentUserPermissions.queryOptions(),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useWorkflowCancelRun(runId: string, options?: { onSuccess?: () => void }) {
  const t = useTranslations('Workflows');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflow.cancelRun.mutationOptions({
      onSuccess: () => {
        toast.success(t('toastWorkflowCancelled'));
        queryClient.invalidateQueries({
          queryKey: trpc.workflow.getRun.queryKey({ id: runId }),
        });
        options?.onSuccess?.();
      },
      onError: () => {
        toast.error(t('errors.failedToLoadWorkflowDetail'));
      },
    }),
  );
}

export function useWorkflowOverrideBlockingTask(
  runId: string,
  options?: { onSuccess?: () => void },
) {
  const t = useTranslations('Workflows.overrideBlockingTask');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflow.overrideBlockingTask.mutationOptions({
      onSuccess: () => {
        toast.success(t('toastSuccess'));
        queryClient.invalidateQueries({
          queryKey: trpc.workflow.getRun.queryKey({ id: runId }),
        });
        options?.onSuccess?.();
      },
      onError: err => {
        toast.error(err.message || t('toastFailure'));
      },
    }),
  );
}

export function useWorkflowSkipTask(runId: string, options?: { onSuccess?: () => void }) {
  const t = useTranslations('Workflows');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflow.skipTask.mutationOptions({
      onSuccess: () => {
        toast.success(t('toastTaskSkipped'));
        queryClient.invalidateQueries({
          queryKey: trpc.workflow.getRun.queryKey({ id: runId }),
        });
        options?.onSuccess?.();
      },
      onError: () => {
        toast.error(t('errors.failedToCompleteTask'));
      },
    }),
  );
}

export function useWorkflowReassignTask(
  runId: string,
  options?: { onSuccess?: (memberName: string) => void },
) {
  const t = useTranslations('Workflows');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflow.reassignTask.mutationOptions({
      onSuccess: (_data, variables) => {
        const members =
          (queryClient.getQueryData(trpc.user.list.queryKey()) as
            | Array<{ userId: string; name: string }>
            | undefined) ?? [];
        const member = members.find(m => m.userId === variables.newAssigneeUserId);
        const name = member?.name ?? variables.newAssigneeUserId;
        toast.success(t('toastTaskReassigned', { name }));
        queryClient.invalidateQueries({
          queryKey: trpc.workflow.getRun.queryKey({ id: runId }),
        });
        options?.onSuccess?.(name);
      },
      onError: () => {
        toast.error(t('errors.failedToCompleteTask'));
      },
    }),
  );
}

export function useWorkflowCompleteTask(runId: string, options?: { onSuccess?: () => void }) {
  const t = useTranslations('Workflows');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.workflow.completeTask.mutationOptions({
      onSuccess: () => {
        toast.success(t('toastTaskCompleted'));
        queryClient.invalidateQueries({
          queryKey: trpc.workflow.getRun.queryKey({ id: runId }),
        });
        options?.onSuccess?.();
      },
      onError: () => {
        toast.error(t('errors.failedToCompleteTask'));
      },
    }),
  );
}

export function useWorkflowTaskComments(runId: string, taskRunId: string) {
  const t = useTranslations('Workflows');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const commentsQuery = useQuery(
    trpc.workflow.listComments.queryOptions({
      workflowRunId: runId,
      workflowTaskRunId: taskRunId,
    }),
  );

  const addCommentMutation = useMutation(
    trpc.workflow.addComment.mutationOptions({
      onSuccess: () => {
        toast.success(t('toastCommentPosted'));
        queryClient.invalidateQueries({
          queryKey: trpc.workflow.listComments.queryKey({
            workflowRunId: runId,
            workflowTaskRunId: taskRunId,
          }),
        });
      },
      onError: () => {
        toast.error(t('errors.failedToPostComment'));
      },
    }),
  );

  return { commentsQuery, addCommentMutation } as const;
}

export function useWorkflowTaskAttachments(taskRunId: string) {
  const trpc = useTRPC();

  return useQuery(
    trpc.document.list.queryOptions({
      entityType: 'WORKFLOW_TASK_RUN' as 'CONTRACT' | 'CONTRACTOR',
      entityId: taskRunId,
      page: 1,
      pageSize: 50,
    }),
  );
}

export function useWorkflowLinearIssue(taskRunId: string) {
  const trpc = useTRPC();

  const connectionQuery = useQuery({
    ...trpc.linear.connectionStatus.queryOptions(),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const linkedQuery = useQuery({
    ...trpc.linear.getLinkedIssue.queryOptions({ taskRunId }),
    enabled: !!connectionQuery.data,
  });

  return { connectionQuery, linkedQuery } as const;
}

export function useWorkflowRunsTable(queryInput: {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: 'createdAt' | 'dueAt' | 'status' | 'startedAt';
  sortOrder?: 'asc' | 'desc';
  filters?: {
    status?: string[];
    templateId?: string[];
    overdueOnly?: boolean;
    contractorId?: string;
  };
}) {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.workflow.listRuns.queryOptions(queryInput),
    placeholderData: keepPreviousData,
  });
}

export function useWorkflowRunsTableTemplates() {
  const trpc = useTRPC();

  return useQuery(
    trpc.workflow.listTemplates.queryOptions({
      page: 1,
      pageSize: 100,
      status: ['ACTIVE', 'DRAFT', 'ARCHIVED'],
    }),
  );
}

export function useWorkflowSidePanelRun(runId: string | null) {
  const trpc = useTRPC();

  const runQuery = useQuery({
    ...trpc.workflow.getRun.queryOptions({ id: runId ?? '' }),
    enabled: !!runId,
  });

  const handleRetry = useCallback(() => {
    void runQuery.refetch();
  }, [runQuery]);

  return {
    run: runQuery.data,
    handleRetry,
    isLoading: runQuery.isLoading,
    isError: runQuery.isError,
  } as const;
}

export function useWorkflowSidePanelJiraIssues(runId: string | null) {
  const trpc = useTRPC();

  const connectionQuery = useQuery({
    ...trpc.jira.connectionStatus.queryOptions(),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const issuesQuery = useQuery({
    ...trpc.jira.linkedIssues.queryOptions({
      entityType: 'WORKFLOW_RUN',
      entityId: runId ?? '',
    }),
    enabled: !!connectionQuery.data && !!runId,
  });

  return { connectionQuery, issuesQuery } as const;
}

export function useWorkflowSidePanelLinearIssues(runId: string | null) {
  const trpc = useTRPC();

  const connectionQuery = useQuery({
    ...trpc.linear.connectionStatus.queryOptions(),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const issuesQuery = useQuery({
    ...trpc.linear.linkedIssues.queryOptions({
      entityType: 'WORKFLOW_RUN',
      entityId: runId ?? '',
    }),
    enabled: !!connectionQuery.data && !!runId,
  });

  return { connectionQuery, issuesQuery } as const;
}

export function useWorkflowSuggestedTemplateEffect(
  suggestedTemplateId: string | null,
  selectedId: string | null,
  setSelectedId: (id: string) => void,
) {
  useEffect(() => {
    if (suggestedTemplateId && !selectedId) {
      setSelectedId(suggestedTemplateId);
    }
  }, [suggestedTemplateId, selectedId, setSelectedId]);
}

export function useWorkflowTemplatePickerTemplates(
  templatesQueryData: unknown,
  typeFilter: string | null,
) {
  return useMemo(() => {
    const result = templatesQueryData as { items: Array<{ id: string; type: string }> } | undefined;
    let items = result?.items ?? [];
    if (typeFilter) {
      items = items.filter(tmpl => tmpl.type === typeFilter);
    }
    return items;
  }, [templatesQueryData, typeFilter]);
}

import { useCallback, useState } from 'react';

import { useWorkflowTaskComments } from './use-workflow-ui.js';

export function useTaskCommentsSection(runId: string, taskRunId: string) {
  const [body, setBody] = useState('');

  const { commentsQuery, addCommentMutation } = useWorkflowTaskComments(runId, taskRunId);

  const comments = commentsQuery.data ?? [];

  const handleSubmit = useCallback(() => {
    const trimmed = body.trim();
    if (!trimmed) return;
    addCommentMutation.mutate(
      {
        workflowRunId: runId,
        workflowTaskRunId: taskRunId,
        body: trimmed,
      },
      { onSuccess: () => setBody('') },
    );
  }, [body, addCommentMutation, runId, taskRunId]);

  return {
    body,
    setBody,
    comments,
    isLoading: commentsQuery.isLoading,
    isSubmitting: addCommentMutation.isPending,
    handleSubmit,
  } as const;
}

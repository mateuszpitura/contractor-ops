import { useCallback, useState } from 'react';

import {
  useWorkflowCompleteTask,
  useWorkflowReassignTask,
  useWorkflowSkipTask,
  useWorkflowTemplateBuilderUsers,
} from './use-workflow-ui.js';

export function useSkipTaskPopover(runId: string) {
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);

  const skipMutation = useWorkflowSkipTask(runId, {
    onSuccess: () => {
      setOpen(false);
      setReason('');
    },
  });

  const handleSkip = useCallback(
    (taskRunId: string) => {
      skipMutation.mutate({ taskRunId, reason: reason.trim() });
    },
    [skipMutation, reason],
  );

  return {
    reason,
    setReason,
    open,
    setOpen,
    skipMutation,
    handleSkip,
  } as const;
}

export function useReassignTaskPopover(runId: string) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [open, setOpen] = useState(false);

  const usersQuery = useWorkflowTemplateBuilderUsers(open);
  const members = usersQuery.data ?? [];

  const reassignMutation = useWorkflowReassignTask(runId, {
    onSuccess: () => {
      setOpen(false);
      setSelectedUserId('');
    },
  });

  const handleReassign = useCallback(
    (taskRunId: string) => {
      reassignMutation.mutate({
        taskRunId,
        newAssigneeUserId: selectedUserId,
      });
    },
    [reassignMutation, selectedUserId],
  );

  return {
    selectedUserId,
    setSelectedUserId,
    open,
    setOpen,
    members,
    reassignMutation,
    handleReassign,
  } as const;
}

export function useTaskCardRun(runId: string) {
  const completeMutation = useWorkflowCompleteTask(runId);
  const skip = useSkipTaskPopover(runId);
  const reassign = useReassignTaskPopover(runId);

  return {
    completeMutation,
    skip,
    reassign,
  } as const;
}

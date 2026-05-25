import { useMemo, useState } from 'react';

import { useWorkflowMyTasks } from './use-workflow-ui.js';

export type MyTaskRow = {
  id: string;
  title: string;
  status: string;
  taskType: string;
  dueAt: string | null;
  isOverdue: boolean;
  workflowRun: {
    id: string;
    status: string;
    contractor: {
      id: string;
      legalName: string;
      displayName: string | null;
    };
    workflowTemplate: {
      name: string;
      type: string;
    };
  };
};

export function useMyTasksList() {
  const [overdueOnly, setOverdueOnly] = useState(false);

  const tasksQuery = useWorkflowMyTasks(overdueOnly);

  const tasks = useMemo(() => {
    const result = tasksQuery.data as { items: MyTaskRow[]; total: number } | undefined;
    return result?.items ?? [];
  }, [tasksQuery.data]);

  return {
    tasks,
    isLoading: tasksQuery.isLoading,
    isError: tasksQuery.isError,
    handleRetry: tasksQuery.handleRetry,
    overdueOnly,
    setOverdueOnly,
  } as const;
}

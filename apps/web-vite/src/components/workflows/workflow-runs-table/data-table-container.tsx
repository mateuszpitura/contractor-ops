import { useWorkflowRunsDataTable } from '../hooks/use-workflow-runs-data-table.js';
import type { WorkflowRunRow } from './columns.js';
import { WorkflowRunsDataTable } from './data-table.js';

interface WorkflowRunsDataTableContainerProps {
  onRowClick: (run: WorkflowRunRow) => void;
  onStartWorkflow: () => void;
  parentLoading?: boolean;
}

export function WorkflowRunsDataTableContainer({
  onRowClick,
  onStartWorkflow,
  parentLoading,
}: WorkflowRunsDataTableContainerProps) {
  const table = useWorkflowRunsDataTable();
  return (
    <WorkflowRunsDataTable
      {...table}
      onRowClick={onRowClick}
      onStartWorkflow={onStartWorkflow}
      parentLoading={parentLoading}
    />
  );
}

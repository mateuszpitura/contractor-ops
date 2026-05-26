import { useWorkflowRunsDataTable } from '../hooks/use-workflow-runs-data-table.js';
import type { WorkflowRunRow } from './columns.js';
import { WorkflowRunsDataTable } from './data-table.js';

interface WorkflowRunsDataTableContainerProps {
  onRowClick: (run: WorkflowRunRow) => void;
  onStartWorkflow: () => void;
  parentLoading?: boolean;
}

// Decision: data-table host — useWorkflowRunsDataTable supplies table state;
// container composes parent's parentLoading prop into tableLoading,
// toolbarDisabled, and showPaginationFooter flags consumed inline by the view.
export function WorkflowRunsDataTableContainer({
  onRowClick,
  onStartWorkflow,
  parentLoading,
}: WorkflowRunsDataTableContainerProps) {
  const table = useWorkflowRunsDataTable();

  const tableLoading = table.isLoading || table.isRefetching || parentLoading === true;
  const toolbarDisabled = table.isLoading || parentLoading === true;
  const showPaginationFooter = !table.isLoading && table.totalRows > 0;

  return (
    <WorkflowRunsDataTable
      {...table}
      onRowClick={onRowClick}
      onStartWorkflow={onStartWorkflow}
      parentLoading={parentLoading}
      tableLoading={tableLoading}
      toolbarDisabled={toolbarDisabled}
      showPaginationFooter={showPaginationFooter}
    />
  );
}

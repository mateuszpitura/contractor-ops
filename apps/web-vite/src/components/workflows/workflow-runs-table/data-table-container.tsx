import { useWorkflowRunsDataTable } from '../hooks/use-workflow-runs-data-table.js';
import type { WorkflowRunRow } from './columns.js';
import { WorkflowRunsDataTable } from './data-table.js';

interface WorkflowRunsDataTableContainerProps {
  onRowClick: (run: WorkflowRunRow) => void;
  onStartWorkflow: () => void;
  parentLoading?: boolean;
}

// Decision: composes the hook's table state with the parent's `parentLoading`
// flag (from `WorkflowRunsTableContainer` / `WorkflowsPage`) to derive three
// view-driving flags: `tableLoading` (table body spinner), `toolbarDisabled`
// (toolbar gating during initial load), and `showPaginationFooter` (suppress
// pagination chrome until rows exist). Cross-boundary state lives here so
// the table view stays presentational.
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

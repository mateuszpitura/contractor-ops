// Decision: roles table mounted by SettingsWorkflowRolesContainer (page-level composition with
// create dialog + permission gate via canCreate). View internally branches on isLoading/empty +
// per-row edit-dialog state. Container is the hook ownership boundary; forwards canCreate/onCreate
// for the inline empty-state CTA.
import { useWorkflowRolesTable } from './hooks/use-workflow-roles-table.js';
import { WorkflowRolesTable } from './workflow-roles-table.js';

interface WorkflowRolesTableContainerProps {
  canCreate?: boolean;
  onCreate?: () => void;
}

export function WorkflowRolesTableContainer(props: WorkflowRolesTableContainerProps) {
  const table = useWorkflowRolesTable();
  return <WorkflowRolesTable {...props} {...table} />;
}

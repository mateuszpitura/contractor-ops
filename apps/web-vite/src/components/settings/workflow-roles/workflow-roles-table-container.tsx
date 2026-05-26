import { useWorkflowRolesTable } from './hooks/use-workflow-roles-table.js';
import { WorkflowRolesTable } from './workflow-roles-table.js';

interface WorkflowRolesTableContainerProps {
  canCreate?: boolean;
  onCreate?: () => void;
}

// Decision: data-table host — roles table mounted by SettingsWorkflowRolesContainer
// (gates canCreate); view delegates loading/empty row variants and per-row edit-dialog
// state to the shared table shell, with empty-state CTA forwarded via props.
export function WorkflowRolesTableContainer(props: WorkflowRolesTableContainerProps) {
  const table = useWorkflowRolesTable();
  return <WorkflowRolesTable {...props} {...table} />;
}

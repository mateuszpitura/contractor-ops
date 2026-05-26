import { useWorkflowRoleFormDialog } from './hooks/use-workflow-role-form-dialog.js';
import type { WorkflowRoleFormInput } from './workflow-role-form-dialog.js';
import { WorkflowRoleFormDialog } from './workflow-role-form-dialog.js';

interface WorkflowRoleFormDialogContainerProps {
  mode: 'create' | 'edit';
  initial?: WorkflowRoleFormInput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decision: dialog host — open/onOpenChange + mode/initial gated by
// SettingsWorkflowRolesContainer (create) or WorkflowRolesTable (edit); hook scopes the
// create/update mutation lifecycle to dialog mount.
export function WorkflowRoleFormDialogContainer({
  mode,
  initial,
  open,
  onOpenChange,
}: WorkflowRoleFormDialogContainerProps) {
  const form = useWorkflowRoleFormDialog({ mode, initial, onOpenChange });
  return (
    <WorkflowRoleFormDialog
      mode={mode}
      initial={initial}
      open={open}
      onOpenChange={onOpenChange}
      {...form}
    />
  );
}

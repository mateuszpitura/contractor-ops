import type { AssignmentDialogProps } from './assignment-dialog.js';
import { AssignmentDialogView } from './assignment-dialog.js';
import { useAssignmentDialog } from './hooks/use-equipment-assignment.js';

// Decisive: mutation host. Owns the contractor search + assign mutation lifecycle
// via `useAssignmentDialog`. View renders a single dialog path (search/select/
// submit); no top-level variant pick exists because the dialog itself IS the
// variant — controlled by the `open` prop from a decisive parent. The inline
// loading indicator inside `CommandEmpty` is presentational micro-state, not
// a hook-driven variant lift candidate.
export function AssignmentDialogContainer(props: AssignmentDialogProps) {
  const dialog = useAssignmentDialog({
    equipmentId: props.equipmentId,
    onOpenChange: props.onOpenChange,
  });

  return <AssignmentDialogView {...props} {...dialog} />;
}

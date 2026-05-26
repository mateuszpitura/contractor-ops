import type { AssignmentDialogProps } from './assignment-dialog.js';
import { AssignmentDialogView } from './assignment-dialog.js';
import { useAssignmentDialog } from './hooks/use-equipment-assignment.js';

// Decision: dialog host — open/onOpenChange gated by EquipmentTableContainer;
// useAssignmentDialog owns the contractor search + assign mutation lifecycle.
export function AssignmentDialogContainer(props: AssignmentDialogProps) {
  const dialog = useAssignmentDialog({
    equipmentId: props.equipmentId,
    onOpenChange: props.onOpenChange,
  });

  return <AssignmentDialogView {...props} {...dialog} />;
}

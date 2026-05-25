import type { BoeRateEntry } from '../hooks/use-admin-boe-rate.js';
import { useBoeRateUpdate, useBoeRateValidation } from '../hooks/use-admin-boe-rate.js';
import { EditBoeRateDialog } from './edit-boe-rate-dialog.js';

interface EditBoeRateDialogContainerProps {
  entry: BoeRateEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Decision: passthrough is intentional here.
 *
 * Mutation host for the edit-rate dialog. The hook bundles the update
 * mutation with its invalidation/toast wiring and the validation
 * helpers; the dialog is single-render-path with no loading/error
 * variant to gate. Mount is already conditioned upstream by
 * BoeRateTableContainer (renders only when an entry is selected).
 */
export function EditBoeRateDialogContainer({
  entry,
  open,
  onOpenChange,
}: EditBoeRateDialogContainerProps) {
  const validation = useBoeRateValidation();
  const updateMutation = useBoeRateUpdate(() => onOpenChange(false));
  return (
    <EditBoeRateDialog
      entry={entry}
      open={open}
      onOpenChange={onOpenChange}
      validation={validation}
      updateMutation={updateMutation}
    />
  );
}

import { useBoeRateInsert, useBoeRateValidation } from '../hooks/use-admin-boe-rate.js';
import { AddBoeRateDialog } from './add-boe-rate-dialog.js';

interface AddBoeRateDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Decision: passthrough is intentional here.
 *
 * Mutation host for the create-rate dialog. The hook bundles the
 * insert mutation with its invalidation/toast wiring and the
 * validation helpers; the dialog is single-render-path with no
 * loading/error/empty variant to gate. Mount is already conditioned
 * upstream by AdminBoeRateContainer via the `open` prop.
 */
export function AddBoeRateDialogContainer({ open, onOpenChange }: AddBoeRateDialogContainerProps) {
  const validation = useBoeRateValidation();
  const insertMutation = useBoeRateInsert(() => onOpenChange(false));
  return (
    <AddBoeRateDialog
      open={open}
      onOpenChange={onOpenChange}
      validation={validation}
      insertMutation={insertMutation}
    />
  );
}

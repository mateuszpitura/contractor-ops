import type { BoeRateEntry } from '../hooks/use-admin-boe-rate.js';
import { useBoeRateDelete } from '../hooks/use-admin-boe-rate.js';
import { DeleteBoeRateDialog } from './delete-boe-rate-dialog.js';

interface DeleteBoeRateDialogContainerProps {
  entry: BoeRateEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Decision: passthrough is intentional here.
 *
 * Mutation host for the delete-rate confirmation dialog. The hook
 * bundles the delete mutation with its invalidation/toast wiring; the
 * dialog is single-render-path with no loading/error variant to gate.
 * Mount is already conditioned upstream by BoeRateTableContainer
 * (renders only when an entry is selected for deletion).
 */
export function DeleteBoeRateDialogContainer({
  entry,
  open,
  onOpenChange,
}: DeleteBoeRateDialogContainerProps) {
  const deleteMutation = useBoeRateDelete(() => onOpenChange(false));
  return (
    <DeleteBoeRateDialog
      entry={entry}
      open={open}
      onOpenChange={onOpenChange}
      deleteMutation={deleteMutation}
    />
  );
}

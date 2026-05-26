import type { BoeRateEntry } from '../hooks/use-admin-boe-rate.js';
import { useBoeRateDelete } from '../hooks/use-admin-boe-rate.js';
import { DeleteBoeRateDialog } from './delete-boe-rate-dialog.js';

interface DeleteBoeRateDialogContainerProps {
  entry: BoeRateEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decision: mutation host — useBoeRateDelete exposes the delete mutation +
// isPending consumed inline by the confirmation dialog. Mount gated upstream
// by BoeRateTableContainer via the entry prop.
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

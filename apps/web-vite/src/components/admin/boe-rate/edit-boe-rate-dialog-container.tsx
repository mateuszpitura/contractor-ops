import type { BoeRateEntry } from '../hooks/use-admin-boe-rate.js';
import { useBoeRateUpdate, useBoeRateValidation } from '../hooks/use-admin-boe-rate.js';
import { EditBoeRateDialog } from './edit-boe-rate-dialog.js';

interface EditBoeRateDialogContainerProps {
  entry: BoeRateEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

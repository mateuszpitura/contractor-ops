import { useBoeRateInsert, useBoeRateValidation } from '../hooks/use-admin-boe-rate.js';
import { AddBoeRateDialog } from './add-boe-rate-dialog.js';

interface AddBoeRateDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

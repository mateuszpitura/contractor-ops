// Decision: confirmation dialog rendered conditionally by UsersTable via open prop. Container
// scopes the deactivate mutation lifecycle per target user.
import { DeactivateDialog } from './deactivate-dialog.js';
import { useDeactivateDialog } from './hooks/use-deactivate-dialog.js';

interface DeactivateDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export function DeactivateDialogContainer({
  open,
  onOpenChange,
  userId,
  userName,
}: DeactivateDialogContainerProps) {
  const dialog = useDeactivateDialog({ open, onOpenChange, userId, userName });
  return (
    <DeactivateDialog
      open={open}
      onOpenChange={onOpenChange}
      userId={userId}
      userName={userName}
      {...dialog}
    />
  );
}

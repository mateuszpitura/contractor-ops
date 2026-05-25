// Decision: dialog rendered conditionally by SettingsMembersContainer via open prop. Container
// scopes the invite mutation lifecycle to dialog mount.
import { useInviteDialog } from './hooks/use-invite-dialog.js';
import { InviteDialog } from './invite-dialog.js';

interface InviteDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteDialogContainer({ open, onOpenChange }: InviteDialogContainerProps) {
  const dialog = useInviteDialog({ open, onOpenChange });
  return <InviteDialog open={open} onOpenChange={onOpenChange} {...dialog} />;
}

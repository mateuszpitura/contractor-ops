import { useInviteDialog } from './hooks/use-invite-dialog.js';
import { InviteDialog } from './invite-dialog.js';

interface InviteDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decision: dialog host — open/onOpenChange gated by SettingsMembersContainer; hook
// scopes the invite mutation lifecycle to dialog mount.
export function InviteDialogContainer({ open, onOpenChange }: InviteDialogContainerProps) {
  const dialog = useInviteDialog({ open, onOpenChange });
  return <InviteDialog open={open} onOpenChange={onOpenChange} {...dialog} />;
}

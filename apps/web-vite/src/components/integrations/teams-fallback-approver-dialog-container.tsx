import { useTeamsFallbackApproverDialog } from './hooks/use-teams-fallback-approver-dialog.js';
import { TeamsFallbackApproverDialogView } from './teams-fallback-approver-dialog.js';

interface TeamsFallbackApproverDialogProps {
  teamId: string;
  currentFallbackApproverId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decisive passthrough: dialog host bound to a mutation. Hook owns
// `selectedUserId` state + save/clear handlers; there is no loading/empty/
// error variant to lift — save button just disables on `setFallbackMutation
// .isPending`, which is inline mutation-pending UI, not a container variant.
export function TeamsFallbackApproverDialog(props: TeamsFallbackApproverDialogProps) {
  const viewProps = useTeamsFallbackApproverDialog(props);
  return <TeamsFallbackApproverDialogView {...viewProps} />;
}

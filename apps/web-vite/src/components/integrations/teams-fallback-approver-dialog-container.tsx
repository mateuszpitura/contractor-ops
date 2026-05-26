import { useTeamsFallbackApproverDialog } from './hooks/use-teams-fallback-approver-dialog.js';
import { TeamsFallbackApproverDialogView } from './teams-fallback-approver-dialog.js';

interface TeamsFallbackApproverDialogProps {
  teamId: string;
  currentFallbackApproverId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decision: dialog host — open/onOpenChange gated by TeamsProviderSection.
// Hook owns selectedUserId + save/clear handlers; save button disables on
// isPending inline (no container variant).
export function TeamsFallbackApproverDialog(props: TeamsFallbackApproverDialogProps) {
  const viewProps = useTeamsFallbackApproverDialog(props);
  return <TeamsFallbackApproverDialogView {...viewProps} />;
}

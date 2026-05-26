import { useLinearStatusMappingDialog } from './hooks/use-linear-status-mapping-dialog.js';
import { LinearStatusMappingDialogView } from './linear-status-mapping-dialog.js';

interface LinearStatusMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decision: dialog host — open/onOpenChange gated by LinearProviderSection.
// Per-row spinners and selectedTeamId table guards are dialog-internal
// interaction state, not a container variant.
export function LinearStatusMappingDialog(props: LinearStatusMappingDialogProps) {
  const viewProps = useLinearStatusMappingDialog(props);
  return <LinearStatusMappingDialogView {...viewProps} />;
}

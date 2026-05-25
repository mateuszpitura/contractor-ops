import { useLinearStatusMappingDialog } from './hooks/use-linear-status-mapping-dialog.js';
import { LinearStatusMappingDialogView } from './linear-status-mapping-dialog.js';

interface LinearStatusMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decisive passthrough: dialog host. Hook returns no top-level isLoading/
// isError flag. Per-row spinners and conditional table render based on
// `selectedTeamId` are dialog-internal interaction state, not a container
// variant pick.
export function LinearStatusMappingDialog(props: LinearStatusMappingDialogProps) {
  const viewProps = useLinearStatusMappingDialog(props);
  return <LinearStatusMappingDialogView {...viewProps} />;
}

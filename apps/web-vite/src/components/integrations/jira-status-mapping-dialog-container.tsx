import { useJiraStatusMappingDialog } from './hooks/use-jira-status-mapping-dialog.js';
import { JiraStatusMappingDialogView } from './jira-status-mapping-dialog.js';

interface JiraStatusMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
}

// Decisive passthrough: dialog host. Hook returns no top-level isLoading/
// isError flag. Per-select spinners and table-render guards on
// `selectedProjectId` are dialog-internal interaction state, not a
// container-level variant pick.
export function JiraStatusMappingDialog(props: JiraStatusMappingDialogProps) {
  const viewProps = useJiraStatusMappingDialog(props);
  return <JiraStatusMappingDialogView {...viewProps} />;
}

import { useJiraStatusMappingDialog } from './hooks/use-jira-status-mapping-dialog.js';
import { JiraStatusMappingDialogView } from './jira-status-mapping-dialog.js';

interface JiraStatusMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
}

// Decision: dialog host — open/onOpenChange gated by JiraProviderSection.
// Per-select spinners and selectedProjectId table guards are dialog-internal
// interaction state, not a container variant.
export function JiraStatusMappingDialog(props: JiraStatusMappingDialogProps) {
  const viewProps = useJiraStatusMappingDialog(props);
  return <JiraStatusMappingDialogView {...viewProps} />;
}

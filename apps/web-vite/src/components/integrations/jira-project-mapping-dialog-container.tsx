import { useJiraProjectMappingDialog } from './hooks/use-jira-project-mapping-dialog.js';
import { JiraProjectMappingDialogView } from './jira-project-mapping-dialog.js';

interface JiraProjectMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTemplateId: string;
  connectionId: string;
}

// Decision: dialog host — open/onOpenChange gated by JiraTaskConfig.
// Per-select loading spinners render inline against sub-resource queries,
// not a container variant.
export function JiraProjectMappingDialog(props: JiraProjectMappingDialogProps) {
  const viewProps = useJiraProjectMappingDialog(props);
  return <JiraProjectMappingDialogView {...viewProps} />;
}

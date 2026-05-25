import { useJiraProjectMappingDialog } from './hooks/use-jira-project-mapping-dialog.js';
import { JiraProjectMappingDialogView } from './jira-project-mapping-dialog.js';

interface JiraProjectMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTemplateId: string;
  connectionId: string;
}

// Decisive passthrough: dialog host bound to the mapping form. Hook returns
// no top-level isLoading/isError flag — per-select loading spinners are
// rendered inline against `projectsQuery.isLoading`/`issueTypesQuery.isLoading`
// (sub-resource UX, not a container variant).
export function JiraProjectMappingDialog(props: JiraProjectMappingDialogProps) {
  const viewProps = useJiraProjectMappingDialog(props);
  return <JiraProjectMappingDialogView {...viewProps} />;
}

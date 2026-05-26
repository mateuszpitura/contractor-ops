import { useProjectFormSheet } from '../hooks/use-project-form-sheet.js';
import { ProjectFormSheet } from './project-form-sheet.js';

interface ProjectFormSheetContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Parameters<typeof ProjectFormSheet>[0]['project'];
  onCreated?: (project: { id: string; name: string }) => void;
}

// Decision: form host — view owns form state; useProjectFormSheet supplies
// create/edit/archive mutations + teams list for the picker. Open/onOpenChange
// gated by OrganizationProjectsContainer.
export function ProjectFormSheetContainer(props: ProjectFormSheetContainerProps) {
  const formSheet = useProjectFormSheet({
    onOpenChange: props.onOpenChange,
    onCreated: props.onCreated,
  });
  return <ProjectFormSheet {...props} formSheet={formSheet} />;
}

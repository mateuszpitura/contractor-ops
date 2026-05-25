import { useProjectFormSheet } from '../hooks/use-project-form-sheet.js';
import { ProjectFormSheet } from './project-form-sheet.js';

interface ProjectFormSheetContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Parameters<typeof ProjectFormSheet>[0]['project'];
  onCreated?: (project: { id: string; name: string }) => void;
}

/**
 * Decision: passthrough is intentional here.
 *
 * Create/edit/archive sheet for projects — mutation host. The hook
 * exposes mutations, `isSubmitting`, and the `teams` list for the
 * team-picker select. There is no sheet-level loading/empty/error
 * variant; the teams query loading state is rendered inline as an
 * empty `<select>` (sub-resource UX, not a container variant). The
 * view owns form state and the create-vs-edit branch is prop-driven.
 * No variant pick, no permission gate, no composition — passthrough.
 */
export function ProjectFormSheetContainer(props: ProjectFormSheetContainerProps) {
  const formSheet = useProjectFormSheet({
    onOpenChange: props.onOpenChange,
    onCreated: props.onCreated,
  });
  return <ProjectFormSheet {...props} formSheet={formSheet} />;
}

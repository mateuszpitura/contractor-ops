import { useTeamFormSheet } from '../hooks/use-team-form-sheet.js';
import { TeamFormSheet } from './team-form-sheet.js';

interface TeamFormSheetContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Parameters<typeof TeamFormSheet>[0]['team'];
  onCreated?: (team: { id: string; name: string }) => void;
}

/**
 * Decision: passthrough is intentional here.
 *
 * Create/edit/archive sheet for teams — mutation host. The hook
 * exposes only mutations + `isSubmitting`; no top-level loading/empty/
 * error variant at the sheet scope. The view owns form state and the
 * create-vs-edit branch is purely prop-driven UX, not a container-level
 * variant. No variant pick, no permission gate, no sub-container
 * composition — the container's only job is to bridge mutations to the
 * form view.
 */
export function TeamFormSheetContainer(props: TeamFormSheetContainerProps) {
  const formSheet = useTeamFormSheet({
    onOpenChange: props.onOpenChange,
    onCreated: props.onCreated,
  });
  return <TeamFormSheet {...props} formSheet={formSheet} />;
}

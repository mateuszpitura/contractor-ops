import { useTeamFormSheet } from '../hooks/use-team-form-sheet.js';
import { TeamFormSheet } from './team-form-sheet.js';

interface TeamFormSheetContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Parameters<typeof TeamFormSheet>[0]['team'];
  onCreated?: (team: { id: string; name: string }) => void;
}

// Decision: form host — view owns form state; useTeamFormSheet supplies
// create/edit/archive mutations + isSubmitting. Open/onOpenChange gated by
// parent; no variant flag.
export function TeamFormSheetContainer(props: TeamFormSheetContainerProps) {
  const formSheet = useTeamFormSheet({
    onOpenChange: props.onOpenChange,
    onCreated: props.onCreated,
  });
  return <TeamFormSheet {...props} formSheet={formSheet} />;
}

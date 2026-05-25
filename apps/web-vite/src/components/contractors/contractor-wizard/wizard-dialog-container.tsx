import { useContractorWizardDialog } from '../hooks/use-contractor-wizard-dialog.js';
import { WizardDialogView } from './wizard-dialog.js';

interface WizardDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decision: render gated externally by parent (contractor-list-container owns
// open state). Container's job is to keep the create-contractor + invite
// mutations and react-hook-form wiring out of the presentational dialog.
export function WizardDialogContainer(props: WizardDialogContainerProps) {
  const dialog = useContractorWizardDialog(props.open, props.onOpenChange);
  return <WizardDialogView {...dialog} />;
}

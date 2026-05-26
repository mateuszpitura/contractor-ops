import { useContractorWizardDialog } from '../hooks/use-contractor-wizard-dialog.js';
import { WizardDialogView } from './wizard-dialog.js';

interface WizardDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decision: dialog host — open/onOpenChange gated by ContractorListContainer;
// useContractorWizardDialog owns create-contractor + invite mutations and
// react-hook-form wiring.
export function WizardDialogContainer(props: WizardDialogContainerProps) {
  const dialog = useContractorWizardDialog(props.open, props.onOpenChange);
  return <WizardDialogView {...dialog} />;
}

import { useContractWizardDialog } from '../hooks/use-contract-wizard-dialog.js';
import { ContractWizardDialog } from './wizard-dialog.js';

interface ContractWizardDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractorId?: string;
}

export function ContractWizardDialogContainer(props: ContractWizardDialogContainerProps) {
  const wizard = useContractWizardDialog(props);
  return <ContractWizardDialog open={props.open} wizard={wizard} />;
}

import type { UseFormReturn } from 'react-hook-form';

import { useContractorWizardAssignmentOptions } from '../hooks/use-contractor-wizard.js';
import { StepAssignmentView } from './step-assignment.js';
import type { WizardFormValues } from './wizard-dialog.js';

interface StepAssignmentContainerProps {
  form: UseFormReturn<WizardFormValues>;
}

// Decision: composition — resolves assignment-options query for the step view;
// WizardDialog step navigation gates when this step renders.
export function StepAssignmentContainer({ form }: StepAssignmentContainerProps) {
  const options = useContractorWizardAssignmentOptions();
  return <StepAssignmentView form={form} {...options} />;
}

import type { UseFormReturn } from 'react-hook-form';

import { useContractorWizardAssignmentOptions } from '../hooks/use-contractor-wizard.js';
import { StepAssignmentView } from './step-assignment.js';
import type { WizardFormValues } from './wizard-dialog.js';

interface StepAssignmentContainerProps {
  form: UseFormReturn<WizardFormValues>;
}

// Decision: render gated externally by parent (wizard-dialog step navigation).
// Container's job is to keep the assignment-options query out of the view.
export function StepAssignmentContainer({ form }: StepAssignmentContainerProps) {
  const options = useContractorWizardAssignmentOptions();
  return <StepAssignmentView form={form} {...options} />;
}

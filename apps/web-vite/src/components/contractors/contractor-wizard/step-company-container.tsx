import type { UseFormReturn } from 'react-hook-form';

import { useContractorCompanyLookup } from '../hooks/use-contractor-wizard.js';
import { StepCompanyView } from './step-company.js';
import type { WizardFormValues } from './wizard-dialog.js';

interface StepCompanyContainerProps {
  form: UseFormReturn<WizardFormValues>;
}

// Decision: render gated externally by parent (wizard-dialog step navigation).
// Container's job is to keep the company-lookup mutation out of the view.
export function StepCompanyContainer({ form }: StepCompanyContainerProps) {
  const { lookup, isLookupLoading } = useContractorCompanyLookup();
  return <StepCompanyView form={form} lookup={lookup} isLookupLoading={isLookupLoading} />;
}

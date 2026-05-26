import type { UseFormReturn } from 'react-hook-form';

import { useContractorCompanyLookup } from '../hooks/use-contractor-wizard.js';
import { StepCompanyView } from './step-company.js';
import type { WizardFormValues } from './wizard-dialog.js';

interface StepCompanyContainerProps {
  form: UseFormReturn<WizardFormValues>;
}

// Decision: mutation host — useContractorCompanyLookup exposes the lookup
// mutation + isLookupLoading; WizardDialog step navigation gates rendering.
export function StepCompanyContainer({ form }: StepCompanyContainerProps) {
  const { lookup, isLookupLoading } = useContractorCompanyLookup();
  return <StepCompanyView form={form} lookup={lookup} isLookupLoading={isLookupLoading} />;
}

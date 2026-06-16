import type { TaxFormSubmissionInput } from '@contractor-ops/validators';
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';

import type { TreatyClaim } from './hooks/use-tax-form-wizard.js';

/**
 * Shared prop shape for the presentational form steps. The hook owns the React
 * Hook Form instance; each step receives the field-level handles plus the step
 * navigation callbacks. Steps never touch tRPC directly.
 */
export interface TaxFormStepProps {
  fieldId: string;
  register: UseFormRegister<TaxFormSubmissionInput>;
  control: Control<TaxFormSubmissionInput>;
  setValue: UseFormSetValue<TaxFormSubmissionInput>;
  errors: FieldErrors<TaxFormSubmissionInput>;
  onContinue: () => void;
  onBack: () => void;
}

/** W-8 steps additionally render the auto-populated treaty claim. */
export interface TaxFormW8StepProps extends TaxFormStepProps {
  /** Server-resolved treaty article + rate; null falls back to the 30% default. */
  treatyClaim: TreatyClaim | null;
}

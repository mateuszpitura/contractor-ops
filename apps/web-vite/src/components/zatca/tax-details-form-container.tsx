import { useTaxDetailsForm } from './hooks/use-tax-details-form.js';
import type { TaxDetailsFormViewProps } from './tax-details-form.js';
import { TaxDetailsFormView } from './tax-details-form.js';

// Decision: form host — TaxDetailsFormView owns react-hook-form locally;
// useTaxDetailsForm supplies submitTaxDetails + isPending for the submit
// button. No variant flag.
export function TaxDetailsForm(
  props: Omit<TaxDetailsFormViewProps, keyof ReturnType<typeof useTaxDetailsForm>>,
) {
  const hook = useTaxDetailsForm(props.onSuccess);
  return <TaxDetailsFormView {...props} {...hook} />;
}

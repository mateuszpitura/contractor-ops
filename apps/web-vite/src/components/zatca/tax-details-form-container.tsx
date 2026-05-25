import { useTaxDetailsForm } from './hooks/use-tax-details-form.js';
import type { TaxDetailsFormViewProps } from './tax-details-form.js';
import { TaxDetailsFormView } from './tax-details-form.js';

/**
 * Decision: passthrough is intentional here.
 *
 * TaxDetailsFormView owns react-hook-form locally (zodResolver + field
 * defaults) so the form state must live inside the view. The hook
 * returns no loading/empty/error variant flag — only `submitTaxDetails`
 * + `isPending` for the submit button. With no variant to pick, no
 * permission gate, and no sub-container composition, the container's
 * sole job is to bridge the hook mutation to the form view. Splitting
 * further would either duplicate the RHF wiring or push it into the
 * container (anti-pattern). Leave as-is until either the hook grows a
 * variant flag or the form gains an alternate render path.
 */
export function TaxDetailsForm(
  props: Omit<TaxDetailsFormViewProps, keyof ReturnType<typeof useTaxDetailsForm>>,
) {
  const hook = useTaxDetailsForm(props.onSuccess);
  return <TaxDetailsFormView {...props} {...hook} />;
}

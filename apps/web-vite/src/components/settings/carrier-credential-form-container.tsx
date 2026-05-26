import { CarrierCredentialForm } from './carrier-credential-form.js';
import { useCarrierCredentialForm } from './hooks/use-carrier-credential-form.js';

interface CarrierCredentialFormContainerProps {
  carrier: 'dpd' | 'ups';
  carrierLabel: string;
}

// Decision: form host — carrier credential form mounted by CarrierProviderSection
// (per dpd/ups); hook scopes the per-carrier credential mutation lifecycle.
export function CarrierCredentialFormContainer({
  carrier,
  carrierLabel,
}: CarrierCredentialFormContainerProps) {
  const form = useCarrierCredentialForm(carrier);
  return <CarrierCredentialForm carrierLabel={carrierLabel} {...form} />;
}

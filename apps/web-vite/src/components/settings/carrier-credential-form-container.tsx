// Decision: form widget mounted by carrier provider section (dpd/ups) inside a decisive parent
// section. Container scopes per-carrier hook lifecycle and forwards carrier label. View owns
// form validation branches via hook's form state.
import { CarrierCredentialForm } from './carrier-credential-form.js';
import { useCarrierCredentialForm } from './hooks/use-carrier-credential-form.js';

interface CarrierCredentialFormContainerProps {
  carrier: 'dpd' | 'ups';
  carrierLabel: string;
}

export function CarrierCredentialFormContainer({
  carrier,
  carrierLabel,
}: CarrierCredentialFormContainerProps) {
  const form = useCarrierCredentialForm(carrier);
  return <CarrierCredentialForm carrierLabel={carrierLabel} {...form} />;
}

import type { CarrierShipmentFormProps } from './carrier-shipment-form.js';
import { CarrierShipmentFormView } from './carrier-shipment-form.js';
import { useCarrierShipmentForm } from './hooks/use-carrier-shipment-form.js';

// Decisive: mutation host. Owns the InPost / DPD / UPS create-shipment mutation
// trio via `useCarrierShipmentForm`. The view branches on `configuredCarriers`
// (a prop passed from a decisive parent) and local carrier-selection state —
// neither is a hook-returned variant flag, so no lift applies. View is a single
// dialog render path parameterized by the chosen carrier fieldset.
export function CarrierShipmentFormContainer(props: CarrierShipmentFormProps) {
  const { isPending, submitShipment } = useCarrierShipmentForm({
    equipmentIds: props.equipmentIds,
    direction: props.direction,
    onSuccess: props.onSuccess,
    onOpenChange: props.onOpenChange,
  });

  return (
    <CarrierShipmentFormView {...props} isPending={isPending} submitShipment={submitShipment} />
  );
}

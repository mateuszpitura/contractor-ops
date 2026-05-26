import type { CarrierShipmentFormProps } from './carrier-shipment-form.js';
import { CarrierShipmentFormView } from './carrier-shipment-form.js';
import { useCarrierShipmentForm } from './hooks/use-carrier-shipment-form.js';

// Decision: form host — view owns react-hook-form and branches on the
// configuredCarriers prop; useCarrierShipmentForm supplies the InPost/DPD/UPS
// submit handlers + isPending.
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

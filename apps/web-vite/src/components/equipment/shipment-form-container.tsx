import { useEquipmentShipmentForm } from './hooks/use-equipment-shipment-form.js';
import type { ShipmentFormProps } from './shipment-form.js';
import { ShipmentFormView } from './shipment-form.js';

// Decision: form host — view owns react-hook-form;
// useEquipmentShipmentForm supplies createMutation + isPending.
export function ShipmentFormContainer(props: ShipmentFormProps) {
  const { createMutation, isPending } = useEquipmentShipmentForm({
    equipmentId: props.equipmentId,
    onSuccess: () => props.onOpenChange(false),
  });
  return <ShipmentFormView {...props} createMutation={createMutation} isPending={isPending} />;
}

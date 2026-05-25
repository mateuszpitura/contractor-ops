import { useEquipmentShipmentForm } from './hooks/use-equipment-shipment-form.js';
import type { ShipmentFormProps } from './shipment-form.js';
import { ShipmentFormView } from './shipment-form.js';

// Decisive: mutation host. Owns the `createShipment` mutation lifecycle via
// `useEquipmentShipmentForm`. View hosts react-hook-form internally and has
// a single dialog render path — no hook-returned variant flag exists to lift.
export function ShipmentFormContainer(props: ShipmentFormProps) {
  const { createMutation, isPending } = useEquipmentShipmentForm({
    equipmentId: props.equipmentId,
    onSuccess: () => props.onOpenChange(false),
  });
  return <ShipmentFormView {...props} createMutation={createMutation} isPending={isPending} />;
}

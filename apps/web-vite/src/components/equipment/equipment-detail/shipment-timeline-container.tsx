import { useEquipmentShipmentEvent } from '../hooks/use-equipment-detail-actions.js';
import type { ShipmentTimelineProps } from './shipment-timeline.js';
import { ShipmentTimelineView } from './shipment-timeline.js';

// Decision: mutation host — useEquipmentShipmentEvent exposes the
// addShipmentEvent mutation; view branches on the currentStatus prop forwarded
// by the parent shipment query.
export function ShipmentTimelineContainer(props: ShipmentTimelineProps) {
  const { mutation: addEventMutation } = useEquipmentShipmentEvent();
  return <ShipmentTimelineView {...props} addEventMutation={addEventMutation} />;
}

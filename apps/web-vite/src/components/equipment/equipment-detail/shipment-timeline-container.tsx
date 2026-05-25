import { useEquipmentShipmentEvent } from '../hooks/use-equipment-detail-actions.js';
import type { ShipmentTimelineProps } from './shipment-timeline.js';
import { ShipmentTimelineView } from './shipment-timeline.js';

// Decisive: mutation host. Owns the `addShipmentEvent` mutation lifecycle via
// `useEquipmentShipmentEvent`. View branches on `currentStatus` (a prop from
// the parent shipment query), never on a hook-returned variant flag, so no
// lift applies — single render path parameterized by status/events.
export function ShipmentTimelineContainer(props: ShipmentTimelineProps) {
  const { mutation: addEventMutation } = useEquipmentShipmentEvent();
  return <ShipmentTimelineView {...props} addEventMutation={addEventMutation} />;
}

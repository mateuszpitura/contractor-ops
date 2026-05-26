/**
 * Inline shipment status display. Lifted from
 * apps/web/src/components/equipment/shipment-condensed.tsx unchanged.
 */

import { ShipmentStatusBadge } from './shipment-status-badge.js';

interface ShipmentCondensedProps {
  shipment: {
    carrier: string;
    currentStatus: string;
    trackingNumber: string | null;
  } | null;
}

export function ShipmentCondensed({ shipment }: ShipmentCondensedProps) {
  if (!shipment) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{shipment.carrier}</span>
      <ShipmentStatusBadge status={shipment.currentStatus} />
      {!!shipment.trackingNumber && (
        <span className="font-mono text-xs text-muted-foreground">{shipment.trackingNumber}</span>
      )}
    </div>
  );
}

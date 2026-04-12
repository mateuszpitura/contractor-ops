'use client';

import { ShipmentStatusBadge } from './shipment-status-badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShipmentCondensedProps {
  shipment: {
    carrier: string;
    currentStatus: string;
    trackingNumber: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Inline condensed display of latest shipment status.
 * Shows carrier name, status badge, and tracking number.
 * Renders nothing if no active shipment.
 */
export function ShipmentCondensed({ shipment }: ShipmentCondensedProps) {
  if (!shipment) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{shipment.carrier}</span>
      <ShipmentStatusBadge status={shipment.currentStatus} />
      {shipment.trackingNumber && (
        <span className="font-mono text-xs text-muted-foreground">{shipment.trackingNumber}</span>
      )}
    </div>
  );
}

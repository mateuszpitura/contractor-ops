/**
 * Shipment status badge.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { tKey } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { enumKey } from '../../lib/enum-key.js';

type ShipmentStatus =
  | 'CREATED'
  | 'LABEL_GENERATED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED';

const STATUS_VARIANT_MAP: Record<
  ShipmentStatus,
  'secondary' | 'info' | 'warning' | 'success' | 'destructive'
> = {
  CREATED: 'secondary',
  LABEL_GENERATED: 'secondary',
  PICKED_UP: 'info',
  IN_TRANSIT: 'info',
  OUT_FOR_DELIVERY: 'warning',
  DELIVERED: 'success',
  FAILED: 'destructive',
  RETURNED: 'secondary',
};

interface ShipmentStatusBadgeProps {
  status: string;
  className?: string;
}

export function ShipmentStatusBadge({ status, className }: ShipmentStatusBadgeProps) {
  const t = useTranslations('Equipment.shipment.status');
  const variant = STATUS_VARIANT_MAP[status as ShipmentStatus] ?? 'secondary';
  const label = tKey(t, enumKey(status));
  return (
    <Badge variant={variant} className={className} aria-label={label}>
      {label}
    </Badge>
  );
}

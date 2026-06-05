/**
 * Equipment status badge.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { tKey } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { enumKey } from '../../lib/enum-key.js';

type EquipmentStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'RETURN_REQUESTED'
  | 'RETURN_IN_TRANSIT'
  | 'RETURNED'
  | 'RETIRED';

const STATUS_VARIANT_MAP: Record<
  EquipmentStatus,
  'success' | 'default' | 'info' | 'warning' | 'secondary' | 'outline'
> = {
  AVAILABLE: 'success',
  ASSIGNED: 'default',
  IN_TRANSIT: 'info',
  DELIVERED: 'success',
  RETURN_REQUESTED: 'warning',
  RETURN_IN_TRANSIT: 'info',
  RETURNED: 'secondary',
  RETIRED: 'outline',
};

interface EquipmentStatusBadgeProps {
  status: string;
  className?: string;
}

export function EquipmentStatusBadge({ status, className }: EquipmentStatusBadgeProps) {
  const t = useTranslations('Equipment.status');
  const variant = STATUS_VARIANT_MAP[status as EquipmentStatus] ?? 'secondary';
  const label = tKey(t, enumKey(status));
  return (
    <Badge variant={variant} className={className} aria-label={label}>
      {label}
    </Badge>
  );
}

import { AtelierStatusPill, statusToVariant, type EquipmentStatusInput } from '@contractor-ops/ui';
import { tKey } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { enumKey } from '../../lib/enum-key.js';

interface EquipmentStatusBadgeProps {
  status: string;
  className?: string;
}

export function EquipmentStatusBadge({ status, className }: EquipmentStatusBadgeProps) {
  const t = useTranslations('Equipment.status');
  const variant = statusToVariant('equipment', status as EquipmentStatusInput);
  const label = tKey(t, enumKey(status));
  return (
    <AtelierStatusPill variant={variant} className={className} aria-label={label}>
      {label}
    </AtelierStatusPill>
  );
}

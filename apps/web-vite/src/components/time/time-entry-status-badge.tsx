import type { TimesheetStatusInput } from '@contractor-ops/ui';
import { AtelierStatusPill, statusToVariant } from '@contractor-ops/ui';
import { tKey } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { enumKey } from '../../lib/enum-key.js';

interface TimeEntryStatusBadgeProps {
  status: TimesheetStatusInput;
}

export function TimeEntryStatusBadge({ status }: TimeEntryStatusBadgeProps) {
  const t = useTranslations('Time.filters');
  const variant = statusToVariant('timesheet', status);
  const label = tKey(t, enumKey(status));
  return <AtelierStatusPill variant={variant}>{label}</AtelierStatusPill>;
}

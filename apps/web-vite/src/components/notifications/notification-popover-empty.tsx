/**
 * Empty-state body rendered inside `NotificationPopoverShell` when the
 * `notification.list` query resolves with zero items. Presentational.
 */

import { BellOff } from 'lucide-react';

import { useTranslations } from '../../i18n/useTranslations.js';

export function NotificationPopoverEmpty() {
  const t = useTranslations('Notifications');
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <BellOff className="h-8 w-8 text-muted-foreground" />
      <span className="mt-2 text-sm text-muted-foreground">{t('empty')}</span>
    </div>
  );
}

import {
  usePortalNotificationPreferences,
  usePortalUpdateNotificationPreference,
} from './use-portal-settings.js';

type NotificationCategory =
  | 'INVOICE_UPDATES'
  | 'PAYMENT_CONFIRMATIONS'
  | 'CONTRACT_CHANGES'
  | 'DOCUMENT_UPLOADS'
  | 'SECURITY_ALERTS';

export function useNotificationPreferencesSection() {
  const prefsQuery = usePortalNotificationPreferences();
  const updatePref = usePortalUpdateNotificationPreference();

  const preferences = prefsQuery.data;

  const getChecked = (category: NotificationCategory): boolean => {
    const pref = preferences?.find(p => p.category === category);
    return pref?.emailEnabled ?? true;
  };

  const handleToggle = (category: NotificationCategory, checked: boolean) => {
    updatePref.mutate({ category, emailEnabled: checked });
  };

  return {
    isPending: prefsQuery.isPending,
    getChecked,
    handleToggle,
  } as const;
}

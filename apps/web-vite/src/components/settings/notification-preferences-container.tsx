import { useNotificationPreferences } from './hooks/use-notification-preferences.js';
import {
  NotificationPreferences,
  NotificationPreferencesSkeleton,
} from './notification-preferences.js';

export function NotificationPreferencesContainer() {
  const prefs = useNotificationPreferences();
  if (prefs.isLoading) return <NotificationPreferencesSkeleton />;
  return <NotificationPreferences {...prefs} />;
}

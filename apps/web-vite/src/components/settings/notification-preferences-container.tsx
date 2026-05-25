// Decision: settings section gated upstream by SettingsIndexContainer (`notifications` tab). View
// branches on isLoading for skeleton + on isSlack/isTeamsConnected for channel availability —
// branches stay in view for test compatibility (see __tests__/notification-preferences.test.tsx).
import { useNotificationPreferences } from './hooks/use-notification-preferences.js';
import { NotificationPreferences } from './notification-preferences.js';

export function NotificationPreferencesContainer() {
  const prefs = useNotificationPreferences();
  return <NotificationPreferences {...prefs} />;
}

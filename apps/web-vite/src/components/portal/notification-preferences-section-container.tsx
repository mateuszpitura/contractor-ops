import { useNotificationPreferencesSection } from './hooks/use-notification-preferences-section.js';
import {
  NotificationPreferencesSection,
  NotificationPreferencesSkeleton,
} from './notification-preferences-section.js';

export function NotificationPreferencesSectionContainer() {
  const prefs = useNotificationPreferencesSection();
  if (prefs.isPending) return <NotificationPreferencesSkeleton />;
  return <NotificationPreferencesSection prefs={prefs} />;
}

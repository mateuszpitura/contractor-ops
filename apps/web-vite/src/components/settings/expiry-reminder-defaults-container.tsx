import { ExpiryReminderDefaults } from './expiry-reminder-defaults.js';
import { useExpiryReminderDefaults } from './hooks/use-expiry-reminder-defaults.js';

// Decision: mutation host — section gated upstream by SettingsIndexContainer (`general`
// tab); hook supplies form state + save handler + isLoading consumed inline by the view.
export function ExpiryReminderDefaultsContainer() {
  const defaults = useExpiryReminderDefaults();
  return <ExpiryReminderDefaults {...defaults} />;
}

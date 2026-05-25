// Decision: settings section gated upstream by SettingsIndexContainer (`general` tab). Hook owns
// form state + isLoading; view renders form. Container is the hook ownership boundary.

import { ExpiryReminderDefaults } from './expiry-reminder-defaults.js';
import { useExpiryReminderDefaults } from './hooks/use-expiry-reminder-defaults.js';

export function ExpiryReminderDefaultsContainer() {
  const defaults = useExpiryReminderDefaults();
  return <ExpiryReminderDefaults {...defaults} />;
}

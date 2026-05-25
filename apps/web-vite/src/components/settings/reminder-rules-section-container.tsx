// Decision: settings section gated upstream by SettingsIndexContainer (`notifications` tab). Hook
// owns rule list query + editor open state; view renders list + editor-dialog opener.
import { useReminderRulesSection } from './hooks/use-reminder-rules-section.js';
import { ReminderRulesSection } from './reminder-rules-section.js';

export function ReminderRulesSectionContainer() {
  const section = useReminderRulesSection();
  return <ReminderRulesSection {...section} />;
}

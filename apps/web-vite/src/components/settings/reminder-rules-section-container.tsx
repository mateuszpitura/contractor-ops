import { useReminderRulesSection } from './hooks/use-reminder-rules-section.js';
import { ReminderRulesSection } from './reminder-rules-section.js';

// Decision: data-table host — rule list mounted by SettingsIndexContainer
// (`notifications` tab); view delegates loading/empty row variants and editor-dialog
// open state to the section's table shell.
export function ReminderRulesSectionContainer() {
  const section = useReminderRulesSection();
  return <ReminderRulesSection {...section} />;
}

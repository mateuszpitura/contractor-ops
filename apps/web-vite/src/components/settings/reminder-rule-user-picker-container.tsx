import { useReminderRuleUserPicker } from './hooks/use-reminder-rule-editor.js';
import { ReminderRuleUserPicker } from './reminder-rule-user-picker.js';

interface ReminderRuleUserPickerContainerProps {
  value: string | undefined;
  onChange: (userId: string) => void;
}

// Decision: dialog host — picker mounted inside ReminderRuleEditor's dialog body; hook
// scopes the member-list query to the parent dialog's mount lifecycle.
export function ReminderRuleUserPickerContainer(props: ReminderRuleUserPickerContainerProps) {
  const picker = useReminderRuleUserPicker(props);
  return <ReminderRuleUserPicker {...picker} />;
}

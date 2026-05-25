// Decision: user-picker widget mounted by ReminderRuleEditor inside a decisive parent dialog.
// Container scopes the member-list query hook lifecycle.
import { useReminderRuleUserPicker } from './hooks/use-reminder-rule-editor.js';
import { ReminderRuleUserPicker } from './reminder-rule-user-picker.js';

interface ReminderRuleUserPickerContainerProps {
  value: string | undefined;
  onChange: (userId: string) => void;
}

export function ReminderRuleUserPickerContainer(props: ReminderRuleUserPickerContainerProps) {
  const picker = useReminderRuleUserPicker(props);
  return <ReminderRuleUserPicker {...picker} />;
}

import type { RuleUserPickerProps } from './hooks/use-rule-user-picker.js';
import { useRuleUserPicker } from './hooks/use-rule-user-picker.js';
import { RuleUserPicker } from './rule-user-picker.js';

// Decision: dialog host — picker mounted inside ReminderRuleEditor / ChainEditorDialog
// bodies; hook scopes the member-list query to the parent dialog's mount lifecycle.
export function RuleUserPickerContainer(props: RuleUserPickerProps) {
  const picker = useRuleUserPicker(props);
  return <RuleUserPicker {...props} {...picker} />;
}

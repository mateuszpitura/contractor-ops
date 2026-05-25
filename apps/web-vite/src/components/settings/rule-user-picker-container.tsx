// Decision: user-picker widget mounted by reminder/approval rule editors inside decisive parent
// dialogs. Container scopes the member-list query hook lifecycle.
import type { RuleUserPickerProps } from './hooks/use-rule-user-picker.js';
import { useRuleUserPicker } from './hooks/use-rule-user-picker.js';
import { RuleUserPicker } from './rule-user-picker.js';

export function RuleUserPickerContainer(props: RuleUserPickerProps) {
  const picker = useRuleUserPicker(props);
  return <RuleUserPicker {...props} {...picker} />;
}

// Decision: editor dialog rendered conditionally by ReminderRulesSection via open prop. Container
// seeds initial rule into hook and scopes save mutation lifecycle.

import { useReminderRuleEditor } from './hooks/use-reminder-rule-editor.js';
import { ReminderRuleEditor } from './reminder-rule-editor.js';
import type { ReminderRule } from './reminder-rules-section.js';

interface ReminderRuleEditorContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: ReminderRule;
}

export function ReminderRuleEditorContainer({
  open,
  onOpenChange,
  rule,
}: ReminderRuleEditorContainerProps) {
  const editor = useReminderRuleEditor({ open, onOpenChange, rule });
  return <ReminderRuleEditor open={open} onOpenChange={onOpenChange} rule={rule} {...editor} />;
}

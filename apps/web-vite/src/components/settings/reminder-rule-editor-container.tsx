import { useReminderRuleEditor } from './hooks/use-reminder-rule-editor.js';
import { ReminderRuleEditor } from './reminder-rule-editor.js';
import type { ReminderRule } from './reminder-rules-section.js';

interface ReminderRuleEditorContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: ReminderRule;
}

// Decision: dialog host — open/onOpenChange + initial rule gated by
// ReminderRulesSection; hook scopes the save mutation lifecycle to dialog mount.
export function ReminderRuleEditorContainer({
  open,
  onOpenChange,
  rule,
}: ReminderRuleEditorContainerProps) {
  const editor = useReminderRuleEditor({ open, onOpenChange, rule });
  return <ReminderRuleEditor open={open} onOpenChange={onOpenChange} rule={rule} {...editor} />;
}

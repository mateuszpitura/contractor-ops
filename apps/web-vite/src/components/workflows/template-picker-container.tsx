import type { TemplatePickerParams } from './hooks/use-template-picker.js';
import { useTemplatePicker } from './hooks/use-template-picker.js';
import { TemplatePicker } from './template-picker-dialog.js';

export function TemplatePickerContainer(props: TemplatePickerParams) {
  const picker = useTemplatePicker(props);
  return <TemplatePicker {...picker} open={props.open} />;
}

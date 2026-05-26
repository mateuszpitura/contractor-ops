import type { TemplatePickerParams } from './hooks/use-template-picker.js';
import { useTemplatePicker } from './hooks/use-template-picker.js';
import {
  TemplatePicker,
  TemplatePickerList,
  TemplatePickerListEmpty,
  TemplatePickerListSkeleton,
} from './template-picker-dialog.js';

export function TemplatePickerContainer(props: TemplatePickerParams) {
  const picker = useTemplatePicker(props);

  let listContent: React.ReactNode;
  if (picker.isLoading) {
    listContent = <TemplatePickerListSkeleton />;
  } else if (picker.templates.length === 0) {
    listContent = <TemplatePickerListEmpty />;
  } else {
    listContent = (
      <TemplatePickerList
        templates={picker.templates}
        selectedId={picker.selectedId}
        setSelectedId={picker.setSelectedId}
      />
    );
  }

  return <TemplatePicker {...picker} open={props.open} listContent={listContent} />;
}

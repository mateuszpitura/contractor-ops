import type { TemplatePickerParams } from './hooks/use-template-picker.js';
import { useTemplatePicker } from './hooks/use-template-picker.js';
import {
  TemplatePicker,
  TemplatePickerList,
  TemplatePickerListEmpty,
  TemplatePickerListSkeleton,
} from './template-picker-dialog.js';

// Decision: three-way variant pick for the dialog body (loading skeleton, empty
// state, or the populated list) computed from the picker hook's `isLoading`
// flag and `templates.length`. The chosen subtree is injected into the
// presentational `TemplatePicker` shell via the `listContent` slot, so the
// shell stays a single render path.
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

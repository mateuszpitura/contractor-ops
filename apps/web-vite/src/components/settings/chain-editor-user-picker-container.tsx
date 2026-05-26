import { ChainEditorUserPicker } from './chain-editor-user-picker.js';
import { useChainEditorUserPicker } from './hooks/use-chain-editor-dialog.js';

interface ChainEditorUserPickerContainerProps {
  value: string | null | undefined;
  onChange: (userId: string | null) => void;
}

// Decision: dialog host — picker mounted inside ChainEditorDialog body; hook scopes
// the member-list query to the parent dialog's mount lifecycle.
export function ChainEditorUserPickerContainer(props: ChainEditorUserPickerContainerProps) {
  const picker = useChainEditorUserPicker(props);
  return <ChainEditorUserPicker {...picker} />;
}

// Decision: user-picker widget mounted by ChainEditorDialog within a decisive parent dialog.
// Container is the hook ownership boundary for the picker's member query.

import { ChainEditorUserPicker } from './chain-editor-user-picker.js';
import { useChainEditorUserPicker } from './hooks/use-chain-editor-dialog.js';

interface ChainEditorUserPickerContainerProps {
  value: string | null | undefined;
  onChange: (userId: string | null) => void;
}

export function ChainEditorUserPickerContainer(props: ChainEditorUserPickerContainerProps) {
  const picker = useChainEditorUserPicker(props);
  return <ChainEditorUserPicker {...picker} />;
}

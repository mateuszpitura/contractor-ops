// Decision: dialog rendered conditionally by ApprovalChainsTab via open prop. Container scopes
// hook lifecycle to dialog mount and forwards chainData edit target. View owns form/save branches.
import type { ChainData } from './chain-editor-dialog.js';
import { ChainEditorDialog } from './chain-editor-dialog.js';
import { useChainEditorDialog } from './hooks/use-chain-editor-dialog.js';

interface ChainEditorDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chainData: ChainData | null;
}

export function ChainEditorDialogContainer({
  open,
  onOpenChange,
  chainData,
}: ChainEditorDialogContainerProps) {
  const editor = useChainEditorDialog({ open, onOpenChange, chainData });
  return (
    <ChainEditorDialog open={open} onOpenChange={onOpenChange} chainData={chainData} {...editor} />
  );
}

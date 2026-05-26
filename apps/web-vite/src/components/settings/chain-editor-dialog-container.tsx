import type { ChainData } from './chain-editor-dialog.js';
import { ChainEditorDialog } from './chain-editor-dialog.js';
import { useChainEditorDialog } from './hooks/use-chain-editor-dialog.js';

interface ChainEditorDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chainData: ChainData | null;
}

// Decision: dialog host — open/onOpenChange + chainData edit target gated by
// ApprovalChainsTab; hook scopes chain editor form + save mutation to dialog mount.
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

import { EditKeyDialog } from './api-keys-tab.js';
import { useEditKeyDialog } from './hooks/use-api-keys-tab.js';

interface EditKeyDialogContainerProps {
  keyId: string;
  initialName: string;
  initialScopes: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decision: dialog host — open/onOpenChange + initial name/scopes gated by ApiKeysTab;
// hook scopes the update mutation lifecycle to dialog mount.
export function EditKeyDialogContainer({
  keyId,
  initialName,
  initialScopes,
  open,
  onOpenChange,
}: EditKeyDialogContainerProps) {
  const dialog = useEditKeyDialog({ keyId, initialName, initialScopes, onOpenChange });
  return (
    <EditKeyDialog
      keyId={keyId}
      initialName={initialName}
      initialScopes={initialScopes}
      open={open}
      onOpenChange={onOpenChange}
      {...dialog}
    />
  );
}

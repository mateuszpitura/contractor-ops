// Decision: dialog rendered conditionally by ApiKeysTab via open prop. Container seeds initial
// name/scopes into hook and scopes update mutation lifecycle.

import { EditKeyDialog } from './api-keys-tab.js';
import { useEditKeyDialog } from './hooks/use-api-keys-tab.js';

interface EditKeyDialogContainerProps {
  keyId: string;
  initialName: string;
  initialScopes: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

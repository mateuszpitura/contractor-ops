// Decision: confirmation dialog rendered conditionally by ApiKeysTab via open prop. Container
// scopes the revoke mutation lifecycle per target key.

import { RevokeKeyDialog } from './api-keys-tab.js';
import { useRevokeKeyDialog } from './hooks/use-api-keys-tab.js';

interface RevokeKeyDialogContainerProps {
  keyId: string;
  keyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RevokeKeyDialogContainer({
  keyId,
  keyName,
  open,
  onOpenChange,
}: RevokeKeyDialogContainerProps) {
  const dialog = useRevokeKeyDialog({ keyId, keyName, onOpenChange });
  return (
    <RevokeKeyDialog
      keyId={keyId}
      keyName={keyName}
      open={open}
      onOpenChange={onOpenChange}
      {...dialog}
    />
  );
}

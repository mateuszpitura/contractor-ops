import { RevokeKeyDialog } from './api-keys-tab.js';
import { useRevokeKeyDialog } from './hooks/use-api-keys-tab.js';

interface RevokeKeyDialogContainerProps {
  keyId: string;
  keyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decision: dialog host — open/onOpenChange + target key gated by ApiKeysTab; hook
// scopes the revoke mutation lifecycle per keyId.
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

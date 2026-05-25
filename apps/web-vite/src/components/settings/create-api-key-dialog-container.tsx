// Decision: dialog rendered conditionally by ApiKeysTab via open prop. Container scopes the
// create-key mutation lifecycle to dialog mount; view owns the post-creation copy/show branch.

import { CreateKeyDialog } from './api-keys-tab.js';
import { useCreateKeyDialog } from './hooks/use-api-keys-tab.js';

interface CreateKeyDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateKeyDialogContainer({ open, onOpenChange }: CreateKeyDialogContainerProps) {
  const dialog = useCreateKeyDialog({ open, onOpenChange });
  return <CreateKeyDialog open={open} onOpenChange={onOpenChange} {...dialog} />;
}

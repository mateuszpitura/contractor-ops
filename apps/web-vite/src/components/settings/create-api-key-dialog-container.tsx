import { CreateKeyDialog } from './api-keys-tab.js';
import { useCreateKeyDialog } from './hooks/use-api-keys-tab.js';

interface CreateKeyDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decision: dialog host — open/onOpenChange gated by ApiKeysTab; hook scopes the
// create-key mutation lifecycle and supplies the post-creation reveal state.
export function CreateKeyDialogContainer({ open, onOpenChange }: CreateKeyDialogContainerProps) {
  const dialog = useCreateKeyDialog({ open, onOpenChange });
  return <CreateKeyDialog open={open} onOpenChange={onOpenChange} {...dialog} />;
}

// Decision: dialog rendered conditionally by KsefProviderSection via open prop. Container scopes
// the multi-step setup flow hook lifecycle and forwards orgNip context.
import { useKsefSetupDialog } from './hooks/use-ksef-setup-dialog.js';
import { KsefSetupDialog } from './ksef-setup-dialog.js';

interface KsefSetupDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgNip: string | null;
}

export function KsefSetupDialogContainer({
  open,
  onOpenChange,
  orgNip,
}: KsefSetupDialogContainerProps) {
  const dialog = useKsefSetupDialog({ onOpenChange, orgNip });
  return <KsefSetupDialog open={open} onOpenChange={onOpenChange} orgNip={orgNip} {...dialog} />;
}

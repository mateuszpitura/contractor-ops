import { useKsefSetupDialog } from './hooks/use-ksef-setup-dialog.js';
import { KsefSetupDialog } from './ksef-setup-dialog.js';

interface KsefSetupDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgNip: string | null;
}

// Decision: dialog host — open/onOpenChange + orgNip gated by KsefProviderSection;
// hook scopes the multi-step setup flow lifecycle to dialog mount.
export function KsefSetupDialogContainer({
  open,
  onOpenChange,
  orgNip,
}: KsefSetupDialogContainerProps) {
  const dialog = useKsefSetupDialog({ onOpenChange, orgNip });
  return <KsefSetupDialog open={open} onOpenChange={onOpenChange} orgNip={orgNip} {...dialog} />;
}

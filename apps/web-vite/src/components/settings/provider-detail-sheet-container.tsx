import type { ReactNode } from 'react';
import { useState } from 'react';

import { useProviderDetailSheet } from './hooks/use-provider-detail-sheet.js';
import { ProviderDetailSheet } from './provider-detail-sheet.js';

interface ProviderDetailSheetContainerProps {
  provider: string;
  displayName: string;
  icon: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decision: side-effect setup — owns local disconnect-dialog state wired through the
// hook's onDisconnectDialogClose; sheet open prop gated by ProviderConnectionCard.
export function ProviderDetailSheetContainer({
  provider,
  displayName,
  icon,
  open,
  onOpenChange,
}: ProviderDetailSheetContainerProps) {
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const sheet = useProviderDetailSheet({
    provider,
    displayName,
    open,
    onOpenChange,
    onDisconnectDialogClose: () => setDisconnectDialogOpen(false),
  });

  return (
    <ProviderDetailSheet
      provider={provider}
      displayName={displayName}
      icon={icon}
      open={open}
      onOpenChange={onOpenChange}
      disconnectDialogOpen={disconnectDialogOpen}
      setDisconnectDialogOpen={setDisconnectDialogOpen}
      {...sheet}
    />
  );
}

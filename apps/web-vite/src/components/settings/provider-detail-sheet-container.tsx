// Decision: side-effect setup — owns local disconnect-dialog state and wires onDisconnectDialogClose
// callback into the hook. Sheet open state is parent-owned (ProviderConnectionCard). View renders
// presentational sheet content.
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

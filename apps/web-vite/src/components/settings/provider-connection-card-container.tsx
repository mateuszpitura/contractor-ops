// Decision: side-effect setup — owns 2 dialog states (disconnect confirm + detail sheet) spanning
// presentational siblings inside the card, and wires onDisconnected callback that closes the
// confirm dialog. Hook owns connection mutation; view renders card with dialog slots.

import type { ReactNode } from 'react';
import { useState } from 'react';

import { useProviderConnectionCard } from './hooks/use-provider-connection-card.js';
import { ProviderConnectionCard } from './provider-connection-card.js';

interface ProviderConnectionCardContainerProps {
  provider: string;
  displayName: string;
  icon: ReactNode;
  description: string;
}

export function ProviderConnectionCardContainer(props: ProviderConnectionCardContainerProps) {
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const card = useProviderConnectionCard({
    provider: props.provider,
    displayName: props.displayName,
    onDisconnected: () => setDisconnectDialogOpen(false),
  });

  return (
    <ProviderConnectionCard
      {...props}
      {...card}
      disconnectDialogOpen={disconnectDialogOpen}
      setDisconnectDialogOpen={setDisconnectDialogOpen}
      detailSheetOpen={detailSheetOpen}
      setDetailSheetOpen={setDetailSheetOpen}
    />
  );
}

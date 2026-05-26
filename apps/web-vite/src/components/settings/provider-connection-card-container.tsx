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

// Decision: side-effect setup — owns disconnect-confirm + detail-sheet dialog states
// spanning sibling slots inside the card; mounted by IntegrationsTab per provider.
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

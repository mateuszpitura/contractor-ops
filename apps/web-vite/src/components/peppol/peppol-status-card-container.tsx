import { useCallback, useState } from 'react';

import { usePeppolStatusCard } from './hooks/use-peppol.js';
import {
  PeppolStatusCardConnected,
  PeppolStatusCardDisconnected,
  PeppolStatusCardSkeleton,
} from './peppol-status-card.js';
import { PeppolWizardContainer } from './peppol-wizard-container.js';

export function PeppolStatusCardContainer() {
  const props = usePeppolStatusCard();
  const [wizardOpen, setWizardOpen] = useState(false);

  const handleConnectClick = useCallback(() => {
    setWizardOpen(true);
  }, []);

  if (props.isLoading) return <PeppolStatusCardSkeleton />;

  if (!(props.isConnected && props.participant)) {
    return (
      <>
        <PeppolStatusCardDisconnected onConnectClick={handleConnectClick} />
        <PeppolWizardContainer open={wizardOpen} onOpenChange={setWizardOpen} />
      </>
    );
  }

  return (
    <PeppolStatusCardConnected
      participant={props.participant}
      connection={props.connection}
      counts={props.counts}
      onDisconnect={props.onDisconnect}
      isDisconnecting={props.isDisconnecting}
    />
  );
}

// Decision: card section mounted by SettingsEInvoicingContainer (page composition). View
// internally branches on isLoading/registration state + owns register/deregister dialog open
// state. Container injects formatter into view alongside hook return.
import { useFormatter } from '../../../i18n/useFormatter.js';
import { usePeppolParticipantCard } from './hooks/use-peppol-participant-card.js';
import { PeppolParticipantCard } from './peppol-participant-card.js';

export function PeppolParticipantCardContainer() {
  const format = useFormatter();
  const card = usePeppolParticipantCard();
  return <PeppolParticipantCard format={format} {...card} />;
}

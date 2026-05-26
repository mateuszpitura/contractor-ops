import { useFormatter } from '../../../i18n/useFormatter.js';
import { usePeppolParticipantCard } from './hooks/use-peppol-participant-card.js';
import { PeppolParticipantCard } from './peppol-participant-card.js';

// Decision: data-table host — participant card mounted by SettingsEInvoicingContainer;
// view delegates loading/registration-state row variants and register/deregister dialog
// state to the card's table shell.
export function PeppolParticipantCardContainer() {
  const format = useFormatter();
  const card = usePeppolParticipantCard();
  return <PeppolParticipantCard format={format} {...card} />;
}

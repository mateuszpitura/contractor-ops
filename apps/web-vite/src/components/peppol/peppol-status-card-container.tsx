import { usePeppolStatusCard } from './hooks/use-peppol.js';
import { PeppolStatusCardView } from './peppol-status-card.js';

export function PeppolStatusCardContainer() {
  const props = usePeppolStatusCard();
  return <PeppolStatusCardView {...props} />;
}

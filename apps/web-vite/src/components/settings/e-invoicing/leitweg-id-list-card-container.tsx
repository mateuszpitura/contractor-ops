// Decision: card section mounted by SettingsEInvoicingContainer (page composition). View
// internally branches on isLoading/isEmpty + owns dialog open state for create + per-row delete.
import { useLeitwegIdListCard } from './hooks/use-leitweg-id-list-card.js';
import { LeitwegIdListCard } from './leitweg-id-list-card.js';

export function LeitwegIdListCardContainer() {
  const card = useLeitwegIdListCard();
  return <LeitwegIdListCard {...card} />;
}

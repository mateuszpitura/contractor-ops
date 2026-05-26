import { useLeitwegIdListCard } from './hooks/use-leitweg-id-list-card.js';
import { LeitwegIdListCard } from './leitweg-id-list-card.js';

// Decision: data-table host — leitweg-id list card mounted by SettingsEInvoicingContainer;
// view delegates loading/empty row variants and per-row create/delete dialog state to the
// card's table shell.
export function LeitwegIdListCardContainer() {
  const card = useLeitwegIdListCard();
  return <LeitwegIdListCard {...card} />;
}

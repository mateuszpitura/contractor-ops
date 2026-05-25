import { useInvoiceManualMatch } from '../hooks/use-invoice-manual-match.js';
import { MatchCard, UnmatchedCard } from './match-card.js';

type MatchCardContainerProps = {
  invoice: Parameters<typeof MatchCard>[0]['invoice'];
  onMatchConfirmed?: () => void;
};

export function MatchCardContainer({ invoice, onMatchConfirmed }: MatchCardContainerProps) {
  const isUnmatched = invoice.matchStatus === 'UNMATCHED';
  const unmatched = useInvoiceManualMatch(invoice.id, onMatchConfirmed, isUnmatched);

  if (isUnmatched) return <UnmatchedCard unmatched={unmatched} />;

  return <MatchCard invoice={invoice} />;
}

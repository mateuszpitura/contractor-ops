import { useClassificationMarketCard } from '../hooks/use-classification-dashboard.js';
import type { MarketCardProps } from './market-card.js';
import { MarketCardView } from './market-card.js';

// Decision: each of the 4 tile queries surfaces independently — the view picks
// per-tile skeleton vs data variant (progressive disclosure). Lifting one
// combined isPending would lose that. Container's job is to keep the 4 tRPC
// queries out of the view.
export function MarketCardContainer(props: MarketCardProps) {
  const marketData = useClassificationMarketCard(props.market);
  return <MarketCardView {...props} {...marketData} />;
}

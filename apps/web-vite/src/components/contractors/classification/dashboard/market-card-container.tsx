import { useClassificationMarketCard } from '../hooks/use-classification-dashboard.js';
import type { MarketCardProps } from './market-card.js';
import { MarketCardView } from './market-card.js';

// Decision: composition — 4 independent tile queries from useClassificationMarketCard
// surface as per-tile skeleton/data variants inside MarketCardView; a combined
// isPending lift would collapse progressive disclosure.
export function MarketCardContainer(props: MarketCardProps) {
  const marketData = useClassificationMarketCard(props.market);
  return <MarketCardView {...props} {...marketData} />;
}

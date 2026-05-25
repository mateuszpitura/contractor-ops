import { useZatcaStatsCards } from './hooks/use-zatca-stats-cards.js';
import { ZatcaStatsCardsSkeleton, ZatcaStatsCardsView } from './zatca-stats-cards.js';

export function ZatcaStatsCards() {
  const { isLoading, ...props } = useZatcaStatsCards();
  if (isLoading) return <ZatcaStatsCardsSkeleton />;
  return <ZatcaStatsCardsView {...props} />;
}

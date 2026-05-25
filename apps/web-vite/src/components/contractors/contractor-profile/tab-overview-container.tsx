import { useContractorTabOverview } from '../hooks/use-contractor-tab-overview.js';
import type { TabOverviewContractor } from './tab-overview.js';
import { TabOverviewView } from './tab-overview.js';

type TabOverviewContainerProps = {
  contractor: TabOverviewContractor;
};

export function TabOverviewContainer({ contractor }: TabOverviewContainerProps) {
  const { showPii, onSwitchTab } = useContractorTabOverview();
  return <TabOverviewView contractor={contractor} showPii={showPii} onSwitchTab={onSwitchTab} />;
}

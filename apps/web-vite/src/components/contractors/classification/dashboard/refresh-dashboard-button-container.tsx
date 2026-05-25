import { useClassificationDashboardRefreshButton } from '../hooks/use-classification-dashboard.js';
import { RefreshDashboardButtonView } from './refresh-dashboard-button.js';

export function RefreshDashboardButtonContainer() {
  const refresh = useClassificationDashboardRefreshButton();
  return <RefreshDashboardButtonView {...refresh} />;
}

import { useClassificationDashboardRefreshButton } from '../hooks/use-classification-dashboard.js';
import { RefreshDashboardButtonView } from './refresh-dashboard-button.js';

// Decision: mutation host — useClassificationDashboardRefreshButton owns the
// queryClient invalidation + timer state; ClassificationDashboard composes
// this button unconditionally.
export function RefreshDashboardButtonContainer() {
  const refresh = useClassificationDashboardRefreshButton();
  return <RefreshDashboardButtonView {...refresh} />;
}

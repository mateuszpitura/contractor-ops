import { useClassificationDashboardRefreshButton } from '../hooks/use-classification-dashboard.js';
import { RefreshDashboardButtonView } from './refresh-dashboard-button.js';

// Decision: render gated externally by parent (dashboard composes unconditionally).
// This container's job is to keep the queryClient invalidation/timer state out of the view.
export function RefreshDashboardButtonContainer() {
  const refresh = useClassificationDashboardRefreshButton();
  return <RefreshDashboardButtonView {...refresh} />;
}

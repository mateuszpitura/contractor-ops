import { useReconciliationSpotCheck } from './hooks/use-reconciliation-spot-check.js';
import { ReconciliationSpotCheckView } from './reconciliation-spot-check.js';

// Decision: form host — view owns form state (contractor/contract/period/
// invoiced amount); useReconciliationSpotCheck supplies the lazy reconciliation
// query, canRun, hasResult, and toast wiring consumed inline by the card.
export function ReconciliationSpotCheck() {
  const spotCheck = useReconciliationSpotCheck();
  return <ReconciliationSpotCheckView {...spotCheck} />;
}

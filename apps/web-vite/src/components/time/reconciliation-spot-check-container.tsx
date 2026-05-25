import { useReconciliationSpotCheck } from './hooks/use-reconciliation-spot-check.js';
import { ReconciliationSpotCheckView } from './reconciliation-spot-check.js';

/**
 * Decision: passthrough is intentional here.
 *
 * Mutation host for the single-contract spot-check card. The hook bundles
 * the form state (contractor/contract/period/invoiced amount), the
 * lazily-triggered reconciliation query, and the toast wiring on failure.
 * The view is a single-render-path form card — selector disables and the
 * result/error blocks are inline subsections of the same card driven by
 * the form's own controlled state (`canRun`, `hasResult`,
 * `reconciliationQuery.isFetching`), not by container-level variant
 * picks. There is no loading/empty/error variant to gate at the section
 * boundary, so lifting a branch here would fragment the card without
 * adding a real decision.
 */
export function ReconciliationSpotCheck() {
  const spotCheck = useReconciliationSpotCheck();
  return <ReconciliationSpotCheckView {...spotCheck} />;
}

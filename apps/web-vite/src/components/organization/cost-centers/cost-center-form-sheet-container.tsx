import { useCostCenterFormSheet } from '../hooks/use-cost-center-form-sheet.js';
import { CostCenterFormSheet } from './cost-center-form-sheet.js';

interface CostCenterFormSheetContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenter?: Parameters<typeof CostCenterFormSheet>[0]['costCenter'];
  onCreated?: (cc: { id: string; name: string }) => void;
}

/**
 * Decision: passthrough is intentional here.
 *
 * Create/edit/archive sheet for cost centers — mutation host. The hook
 * exposes only mutations + `isSubmitting`; no top-level loading/empty/
 * error variant at the sheet scope. The view owns form state (name,
 * code) and the create-vs-edit branch is purely prop-driven UX, not a
 * container-level variant. With no variant pick, no permission gate,
 * and no sub-container composition, the container's only job is to
 * bridge mutations to the form view.
 */
export function CostCenterFormSheetContainer(props: CostCenterFormSheetContainerProps) {
  const formSheet = useCostCenterFormSheet({
    onOpenChange: props.onOpenChange,
    onCreated: props.onCreated,
  });
  return <CostCenterFormSheet {...props} formSheet={formSheet} />;
}

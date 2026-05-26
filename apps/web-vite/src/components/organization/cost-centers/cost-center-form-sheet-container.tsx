import { useCostCenterFormSheet } from '../hooks/use-cost-center-form-sheet.js';
import { CostCenterFormSheet } from './cost-center-form-sheet.js';

interface CostCenterFormSheetContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenter?: Parameters<typeof CostCenterFormSheet>[0]['costCenter'];
  onCreated?: (cc: { id: string; name: string }) => void;
}

// Decision: form host — view owns form state (name, code); useCostCenterFormSheet
// supplies create/edit/archive mutations + isSubmitting. Open/onOpenChange gated
// by OrganizationCostCentersContainer; no variant flag.
export function CostCenterFormSheetContainer(props: CostCenterFormSheetContainerProps) {
  const formSheet = useCostCenterFormSheet({
    onOpenChange: props.onOpenChange,
    onCreated: props.onCreated,
  });
  return <CostCenterFormSheet {...props} formSheet={formSheet} />;
}

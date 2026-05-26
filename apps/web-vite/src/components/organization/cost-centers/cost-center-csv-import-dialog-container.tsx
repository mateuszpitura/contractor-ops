import { useCostCenterCsvImport } from '../hooks/use-cost-center-csv-import.js';
import { CostCenterCsvImportDialog } from './cost-center-csv-import-dialog.js';

interface CostCenterCsvImportDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decision: mutation host — useCostCenterCsvImport exposes importMutation +
// importRows consumed inline; view owns CSV parsing state. Open gated by
// OrganizationCostCentersContainer.
export function CostCenterCsvImportDialogContainer(props: CostCenterCsvImportDialogContainerProps) {
  const csvImport = useCostCenterCsvImport(props.onOpenChange);
  return <CostCenterCsvImportDialog {...props} csvImport={csvImport} />;
}

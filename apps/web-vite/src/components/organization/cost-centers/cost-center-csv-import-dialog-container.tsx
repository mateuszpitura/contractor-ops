import { useCostCenterCsvImport } from '../hooks/use-cost-center-csv-import.js';
import { CostCenterCsvImportDialog } from './cost-center-csv-import-dialog.js';

interface CostCenterCsvImportDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Decision: passthrough is intentional here.
 *
 * CSV import dialog is a mutation host. The hook exposes only
 * `importMutation` + `importRows` — no top-level loading/empty/error
 * variant the container could pick. The view owns CSV parsing state
 * (file errors, parsed rows, per-row selection) which is local
 * interaction state, not a section-level variant. With no variant pick,
 * no permission gate, no Suspense and no sub-container composition,
 * the container's only job is to bridge the mutation to the dialog.
 */
export function CostCenterCsvImportDialogContainer(props: CostCenterCsvImportDialogContainerProps) {
  const csvImport = useCostCenterCsvImport(props.onOpenChange);
  return <CostCenterCsvImportDialog {...props} csvImport={csvImport} />;
}

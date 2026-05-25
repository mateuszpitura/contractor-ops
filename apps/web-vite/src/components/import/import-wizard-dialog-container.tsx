import { useImportWizardDialog } from './hooks/use-import-wizard.js';
import type { ImportWizardDialogProps } from './import-wizard-dialog.js';
import { ImportWizardDialogView } from './import-wizard-dialog.js';

export function ImportWizardDialogContainer(props: ImportWizardDialogProps) {
  const wizard = useImportWizardDialog(props);
  return <ImportWizardDialogView {...props} {...wizard} />;
}

import { DirectoryImportWizardView } from './directory-import-wizard.js';
import { useDirectoryImportWizard } from './hooks/use-directory-import-wizard.js';

interface DirectoryImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decisive passthrough: multi-step wizard dialog. Branching on `step`,
// `directoryQuery.isLoading/isError`, and `listGroupsMutation.isPending` is
// wizard-internal step state — not a top-level container variant pick. The
// hook returns no isLoading/isError/isEmpty flag at the wizard scope.
export function DirectoryImportWizard(props: DirectoryImportWizardProps) {
  const viewProps = useDirectoryImportWizard(props);
  return <DirectoryImportWizardView {...viewProps} />;
}

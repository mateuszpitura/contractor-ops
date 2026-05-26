import { DirectoryImportWizardView } from './directory-import-wizard.js';
import { useDirectoryImportWizard } from './hooks/use-directory-import-wizard.js';

interface DirectoryImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decision: dialog host — open/onOpenChange gated by GoogleWorkspaceProviderSection.
// Internal step/loading branching is wizard-local interaction state, not a
// container variant.
export function DirectoryImportWizard(props: DirectoryImportWizardProps) {
  const viewProps = useDirectoryImportWizard(props);
  return <DirectoryImportWizardView {...viewProps} />;
}

import { useTopBar } from './hooks/use-top-bar.js';
import { useTopBarBreadcrumbs } from './hooks/use-top-bar-breadcrumbs.js';
import { TopBar } from './top-bar.js';

export function TopBarContainer() {
  const { hasContractors, navigateToNewContractor, navigateToUploadInvoice } = useTopBar();
  const { segments, contractWizardOpen, setContractWizardOpen, openContractWizard, openSearch } =
    useTopBarBreadcrumbs();

  return (
    <TopBar
      hasContractors={hasContractors}
      navigateToNewContractor={navigateToNewContractor}
      navigateToUploadInvoice={navigateToUploadInvoice}
      segments={segments}
      contractWizardOpen={contractWizardOpen}
      onContractWizardOpenChange={setContractWizardOpen}
      onOpenContractWizard={openContractWizard}
      onOpenSearch={openSearch}
    />
  );
}

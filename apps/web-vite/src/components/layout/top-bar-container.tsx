// Decision: composes two top-bar hooks — useTopBar (contractor-count query →
// `hasContractors` gate for new-contract / upload-invoice CTAs + nav callbacks)
// and useTopBarBreadcrumbs (route-segment derivation + contract-wizard /
// search dialog state owner). Both hooks own React Query / route boundaries;
// container is the hook composition + view wiring boundary.

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

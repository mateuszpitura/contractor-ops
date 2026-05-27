import { useTopBar } from './hooks/use-top-bar.js';
import { useTopBarBreadcrumbs } from './hooks/use-top-bar-breadcrumbs.js';
import { TopBar } from './top-bar.js';

// Decision: composition — bridges useTopBar (contractor-count query + the
// contractor / invoice dialog state) and useTopBarBreadcrumbs (route segments
// + contract dialog state) into the TopBar view.
export function TopBarContainer() {
  const {
    hasContractors,
    contractorWizardOpen,
    setContractorWizardOpen,
    openContractorWizard,
    invoiceUploadOpen,
    setInvoiceUploadOpen,
    openInvoiceUpload,
  } = useTopBar();
  const { segments, contractWizardOpen, setContractWizardOpen, openContractWizard, openSearch } =
    useTopBarBreadcrumbs();

  return (
    <TopBar
      hasContractors={hasContractors}
      onOpenContractorWizard={openContractorWizard}
      onOpenInvoiceUpload={openInvoiceUpload}
      segments={segments}
      contractWizardOpen={contractWizardOpen}
      onContractWizardOpenChange={setContractWizardOpen}
      onOpenContractWizard={openContractWizard}
      contractorWizardOpen={contractorWizardOpen}
      onContractorWizardOpenChange={setContractorWizardOpen}
      invoiceUploadOpen={invoiceUploadOpen}
      onInvoiceUploadOpenChange={setInvoiceUploadOpen}
      onOpenSearch={openSearch}
    />
  );
}

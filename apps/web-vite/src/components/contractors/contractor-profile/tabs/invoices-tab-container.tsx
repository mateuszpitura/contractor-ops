import { useContractorTabInvoices } from '../../hooks/use-contractor-tab-invoices.js';
import { InvoicesTabEmpty, InvoicesTabView } from './invoices-tab.js';

type InvoicesTabContainerProps = {
  contractorId: string;
};

export function InvoicesTabContainer({ contractorId }: InvoicesTabContainerProps) {
  const invoices = useContractorTabInvoices(contractorId);

  if (!invoices.isLoading && invoices.data.length === 0) {
    return (
      <InvoicesTabEmpty
        uploadOpen={invoices.uploadOpen}
        setUploadOpen={invoices.setUploadOpen}
        handleUploadComplete={invoices.handleUploadComplete}
      />
    );
  }

  return <InvoicesTabView {...invoices} />;
}

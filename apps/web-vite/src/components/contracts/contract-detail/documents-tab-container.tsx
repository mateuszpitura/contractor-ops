import { useContractDocumentsTab } from '../hooks/use-contract-documents-tab.js';
import { DocumentsTab } from './documents-tab.js';
import { SendForSignatureDialogContainer } from './send-for-signature-dialog-container.js';

type DocumentsTabContainerProps = {
  contractId: string;
  contractParties?: Parameters<typeof SendForSignatureDialogContainer>[0]['contractParties'];
};

export function DocumentsTabContainer({
  contractId,
  contractParties = [],
}: DocumentsTabContainerProps) {
  const documents = useContractDocumentsTab(contractId);

  return (
    <>
      <DocumentsTab
        contractId={contractId}
        contractParties={contractParties}
        documents={documents}
      />
      <SendForSignatureDialogContainer
        open={documents.signDialogOpen}
        onOpenChange={documents.setSignDialogOpen}
        contractId={contractId}
        documentId={documents.selectedDocId}
        contractParties={contractParties}
      />
    </>
  );
}

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { PenLine } from 'lucide-react';
import { memo, useCallback } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { DocumentListContainer } from '../../documents/document-list.js';
import { DropZoneContainer } from '../../documents/drop-zone.js';
import { useContractDocumentsTab } from '../hooks/use-contract-documents-tab.js';
import type { useContractDocumentsTab as UseContractDocumentsTab } from '../hooks/use-contract-documents-tab.js';
import { SendForSignatureDialog } from './send-for-signature-dialog.js';

type DocumentsTabProps = {
  contractId: string;
  contractParties?: Array<{
    name: string;
    email: string;
    role: 'signer' | 'countersigner';
  }>;
  documents: ReturnType<typeof UseContractDocumentsTab>;
};

function SignableDocumentButton({
  documentId,
  label,
  onSend,
}: {
  documentId: string;
  label: string;
  onSend: (documentId: string) => void;
}) {
  const handleClick = useCallback(() => onSend(documentId), [documentId, onSend]);
  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <PenLine className="me-1.5 size-3.5" />
      {label}
    </Button>
  );
}

const SignableDocumentButtonMemo = memo(SignableDocumentButton);

export function SignableDocumentButtons({
  documents,
  onSend,
}: {
  documents: Array<{ id: string; originalFileName: string }>;
  onSend: (documentId: string) => void;
}) {
  const t = useTranslations('ContractDetail.documents');
  return (
    <div className="flex flex-wrap gap-2">
      {documents.map(doc => (
        <SignableDocumentButtonMemo
          key={doc.id}
          documentId={doc.id}
          label={t('sendForSignature', { name: doc.originalFileName })}
          onSend={onSend}
        />
      ))}
    </div>
  );
}

export function DocumentsTab({ contractId, documents }: DocumentsTabProps) {
  const { handleSendForSignature, hasProvider, documents: docList } = documents;
  const showSignButtons = hasProvider && docList.length > 0;

  return (
    <div className="space-y-6">
      <DropZoneContainer entityType="CONTRACT" entityId={contractId} />

      {showSignButtons && (
        <SignableDocumentButtons documents={docList} onSend={handleSendForSignature} />
      )}

      <DocumentListContainer entityType="CONTRACT" entityId={contractId} />
    </div>
  );
}

type DocumentsTabWiredProps = {
  contractId: string;
  contractParties?: Array<{
    name: string;
    email: string;
    role: 'signer' | 'countersigner';
  }>;
};

export function DocumentsTabWired({
  contractId,
  contractParties = [],
}: DocumentsTabWiredProps) {
  const documents = useContractDocumentsTab(contractId);

  return (
    <>
      <DocumentsTab contractId={contractId} documents={documents} />
      {documents.signDialogOpen && (
        <SendForSignatureDialog
          open={documents.signDialogOpen}
          onOpenChange={documents.setSignDialogOpen}
          contractId={contractId}
          documentId={documents.selectedDocId}
          contractParties={contractParties}
        />
      )}
    </>
  );
}

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { PenLine } from 'lucide-react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { DocumentListContainer } from '../../documents/document-list-container.js';
import { DropZoneContainer } from '../../documents/drop-zone-container.js';
import type { useContractDocumentsTab } from '../hooks/use-contract-documents-tab.js';

type DocumentsTabProps = {
  contractId: string;
  contractParties?: Array<{
    name: string;
    email: string;
    role: 'signer' | 'countersigner';
  }>;
  documents: ReturnType<typeof useContractDocumentsTab>;
};

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
        <Button
          key={doc.id}
          variant="outline"
          size="sm"
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => onSend(doc.id)}>
          <PenLine className="me-1.5 size-3.5" />
          {t('sendForSignature', { name: doc.originalFileName })}
        </Button>
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

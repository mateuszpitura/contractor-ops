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

export function DocumentsTab({ contractId, documents }: DocumentsTabProps) {
  const t = useTranslations('ContractDetail.documents');

  const { handleSendForSignature, hasProvider, documents: docList } = documents;

  return (
    <div className="space-y-6">
      <DropZoneContainer entityType="CONTRACT" entityId={contractId} />

      {hasProvider && docList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {docList.map(doc => (
            <Button
              key={doc.id}
              variant="outline"
              size="sm"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => handleSendForSignature(doc.id)}>
              <PenLine className="me-1.5 size-3.5" />
              {t('sendForSignature', { name: doc.originalFileName })}
            </Button>
          ))}
        </div>
      )}

      <DocumentListContainer entityType="CONTRACT" entityId={contractId} />
    </div>
  );
}

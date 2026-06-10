import { AtelierEmptyState, DocumentsIllustration, SectionLabel } from '@contractor-ops/ui';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Files } from 'lucide-react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { DocumentCardContainer } from '../../documents/document-card.js';
import { DropZoneContainer } from '../../documents/drop-zone.js';
import type { DocumentListItem } from '../../documents/types.js';
import { renderEmptyStateAction } from '../../shared/atelier-bridges.js';
import { useContractorTabDocuments } from '../hooks/use-contractor-tab-documents.js';

type TabDocumentsProps = {
  contractorId: string;
  documents: DocumentListItem[];
};

export function TabDocumentsSkeleton({ contractorId }: { contractorId: string }) {
  const t = useTranslations('Documents');
  return (
    <div className="space-y-6">
      <SectionLabel icon={Files}>{t('contractorTab.heading')}</SectionLabel>
      <DropZoneContainer entityType="CONTRACTOR" entityId={contractorId} disabled />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={`skel-${i}`} className="flex items-start gap-4 rounded-lg border p-4">
            <Skeleton className="size-12 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TabDocumentsEmpty({ contractorId }: { contractorId: string }) {
  const t = useTranslations('Documents');
  return (
    <div className="space-y-6">
      <SectionLabel icon={Files}>{t('contractorTab.heading')}</SectionLabel>
      <DropZoneContainer entityType="CONTRACTOR" entityId={contractorId} />
      <AtelierEmptyState
        variant="subview"
        illustration={DocumentsIllustration}
        heading={t('contractorTab.emptyHeading')}
        body={t('contractorTab.emptyBody')}
        renderAction={renderEmptyStateAction}
      />
    </div>
  );
}

export function TabDocuments({ contractorId, documents }: TabDocumentsProps) {
  const t = useTranslations('Documents');

  return (
    <div className="space-y-6">
      <SectionLabel icon={Files}>{t('contractorTab.heading')}</SectionLabel>

      <DropZoneContainer entityType="CONTRACTOR" entityId={contractorId} />

      <div className="space-y-3">
        {documents.map((doc, i) => (
          <DocumentCardContainer key={doc.id} document={doc} versionNumber={documents.length - i} />
        ))}
      </div>
    </div>
  );
}

export function TabDocumentsSection({ contractorId }: { contractorId: string }) {
  const { documents, isLoading } = useContractorTabDocuments(contractorId);

  if (isLoading) return <TabDocumentsSkeleton contractorId={contractorId} />;
  if (documents.length === 0) return <TabDocumentsEmpty contractorId={contractorId} />;

  return <TabDocuments contractorId={contractorId} documents={documents} />;
}

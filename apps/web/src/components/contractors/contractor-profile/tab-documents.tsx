'use client';

import { AtelierEmptyState, DocumentsIllustration } from '@contractor-ops/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { DocumentCard } from '@/components/documents/document-card';
import { DropZone } from '@/components/documents/drop-zone';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabDocumentsProps = {
  contractorId: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TabDocuments({ contractorId }: TabDocumentsProps) {
  const t = useTranslations('Documents');

  const documentsQuery = useQuery(
    trpc.document.list.queryOptions({
      entityType: 'CONTRACTOR' as const,
      entityId: contractorId,
      page: 1,
      pageSize: 50,
    }),
  );

  // tRPC returns documents with extra relations; narrow to what components need
  const documents = (documentsQuery.data?.items ?? []) as unknown as Array<{
    id: string;
    originalFileName: string;
    mimeType: string;
    fileSizeBytes: number;
    virusScanStatus: string;
    createdAt: string | Date;
    uploadedByUserId: string | null;
    status: string;
  }>;

  const isLoading = documentsQuery.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">{t('contractorTab.heading')}</h3>
      </div>

      {/* Drop zone for uploads — disabled while initial list loads */}
      <DropZone entityType="CONTRACTOR" entityId={contractorId} disabled={isLoading} />

      {/* Document cards — skeleton placeholders during initial load */}
      {isLoading ? (
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
      ) : documents.length === 0 ? (
        <AtelierEmptyState
          variant="subview"
          illustration={DocumentsIllustration}
          heading={t('contractorTab.emptyHeading')}
          body={t('contractorTab.emptyBody')}
          renderAction={renderEmptyStateAction}
        />
      ) : (
        <div className="space-y-3">
          {documents.map((doc, i) => (
            <DocumentCard key={doc.id} document={doc} versionNumber={documents.length - i} />
          ))}
        </div>
      )}
    </div>
  );
}

import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { FileText } from 'lucide-react';
import type { ReactNode } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { DocumentCardContainer } from './document-card.js';
import { useDocumentList } from './hooks/use-document-list.js';

type DocumentListProps = {
  isLoading: boolean;
  isEmpty: boolean;
  children: ReactNode;
};

const DOCUMENT_SKELETON_KEYS = ['doc-a', 'doc-b', 'doc-c'] as const;

export function DocumentList({ isLoading, isEmpty, children }: DocumentListProps) {
  const t = useTranslations('Documents');

  if (isLoading) {
    return (
      <div className="space-y-3">
        {DOCUMENT_SKELETON_KEYS.map(key => (
          <div key={key} className="flex items-start gap-4 rounded-lg border p-4">
            <Skeleton className="size-12 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center">
        <FileText className="size-8 text-muted-foreground/50" />
        <h4 className="text-sm font-medium text-muted-foreground">{t('empty.title')}</h4>
        <p className="max-w-sm text-sm text-muted-foreground">{t('empty.description')}</p>
      </div>
    );
  }

  return <div className="space-y-3">{children}</div>;
}

type DocumentListContainerProps = {
  entityType: string;
  entityId: string;
};

export function DocumentListContainer({ entityType, entityId }: DocumentListContainerProps) {
  const { documents, isLoading, isEmpty, onUploadNewVersion } = useDocumentList(
    entityType,
    entityId,
  );

  if (isLoading) {
    return (
      <DocumentList isLoading isEmpty={false}>
        {null}
      </DocumentList>
    );
  }
  if (isEmpty) {
    return (
      <DocumentList isLoading={false} isEmpty>
        {null}
      </DocumentList>
    );
  }

  return (
    <DocumentList isLoading={false} isEmpty={false}>
      {documents.map((doc, i) => (
        <DocumentCardContainer
          key={doc.id}
          document={doc}
          versionNumber={documents.length - i}
          onUploadNewVersion={onUploadNewVersion}
        />
      ))}
    </DocumentList>
  );
}

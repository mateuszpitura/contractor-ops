import { DocumentCardContainer } from './document-card-container.js';
import { DocumentList } from './document-list.js';
import { useDocumentList } from './hooks/use-document-list.js';

type DocumentListContainerProps = {
  entityType: string;
  entityId: string;
};

export function DocumentListContainer({ entityType, entityId }: DocumentListContainerProps) {
  const { documents, isLoading, isEmpty, onUploadNewVersion } = useDocumentList(
    entityType,
    entityId,
  );

  return (
    <DocumentList isLoading={isLoading} isEmpty={isEmpty}>
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

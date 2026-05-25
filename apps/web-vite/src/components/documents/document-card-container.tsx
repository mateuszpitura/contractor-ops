import { DocumentCardView } from './document-card.js';
import { useDocumentCard } from './hooks/use-document-card.js';
import type { DocumentListItem } from './types.js';

type DocumentCardContainerProps = {
  document: DocumentListItem;
  versionNumber?: number;
  onUploadNewVersion?: (documentId: string) => void;
};

export function DocumentCardContainer({
  document,
  versionNumber,
  onUploadNewVersion,
}: DocumentCardContainerProps) {
  const cardActions = useDocumentCard({ document, onUploadNewVersion });

  return <DocumentCardView versionNumber={versionNumber} cardActions={cardActions} />;
}

export function DocumentCard(props: DocumentCardContainerProps) {
  return <DocumentCardContainer {...props} />;
}

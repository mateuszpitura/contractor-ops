import { DocumentCardView } from './document-card.js';
import { useDocumentCard } from './hooks/use-document-card.js';
import type { DocumentListItem } from './types.js';

type DocumentCardContainerProps = {
  document: DocumentListItem;
  versionNumber?: number;
  onUploadNewVersion?: (documentId: string) => void;
};

/**
 * Decision rule (apps/web-vite/ARCHITECTURE.md): this container is the
 * mandatory tRPC/mutation boundary for the card — `useDocumentCard` owns the
 * delete mutation, download trigger, and preview/delete dialog state. The
 * data (`document`) is fully resolved by the parent list, so there is no
 * loading/error/empty variant to pick; conditional UI inside the view
 * (PDF preview button, infected/clean badge, disabled download) is per-
 * attribute presentational branching, not a variant pick. Kept as a thin
 * mutation host per the audit's annotation-only criterion.
 */
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

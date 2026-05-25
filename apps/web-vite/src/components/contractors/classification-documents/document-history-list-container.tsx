import { useDocumentHistoryList } from '../hooks/use-classification-documents.js';
import {
  DocumentHistoryListEmpty,
  DocumentHistoryListSkeleton,
  DocumentHistoryListView,
} from './document-history-list.js';

interface DocumentHistoryListContainerProps {
  engagementId: string;
}

export function DocumentHistoryListContainer({ engagementId }: DocumentHistoryListContainerProps) {
  const { listQuery, docs, downloadDocument } = useDocumentHistoryList(engagementId);

  if (listQuery.isPending) return <DocumentHistoryListSkeleton />;
  if (docs.length === 0) return <DocumentHistoryListEmpty />;

  return (
    <DocumentHistoryListView
      engagementId={engagementId}
      docs={docs}
      downloadDocument={downloadDocument}
    />
  );
}

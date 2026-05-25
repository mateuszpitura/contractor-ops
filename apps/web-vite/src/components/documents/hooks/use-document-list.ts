import { useQuery } from '@tanstack/react-query';

import { useUploadNewVersion } from '../../../hooks/use-upload-new-version.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { DocumentListItem } from '../types.js';

export interface DocumentListProps {
  documents: DocumentListItem[];
  isLoading: boolean;
  isEmpty: boolean;
  onUploadNewVersion: (documentId: string) => void;
}

export function useDocumentList(entityType: string, entityId: string): DocumentListProps {
  const trpc = useTRPC();
  const onUploadNewVersion = useUploadNewVersion();

  const documentsQuery = useQuery(
    trpc.document.list.queryOptions({
      entityType: entityType as 'CONTRACT' | 'CONTRACTOR',
      entityId,
      page: 1,
      pageSize: 50,
    }),
  );

  const documents = (documentsQuery.data?.items ?? []) as unknown as DocumentListItem[];

  return {
    documents,
    isLoading: documentsQuery.isLoading,
    isEmpty: !documentsQuery.isLoading && documents.length === 0,
    onUploadNewVersion,
  };
}

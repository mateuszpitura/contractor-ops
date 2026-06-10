import type { AppRouter } from '@contractor-ops/api';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';

import { useUploadNewVersion } from '../../../hooks/use-upload-new-version.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { DocumentListItem } from '../types.js';

type DocumentListOutputItem = inferRouterOutputs<AppRouter>['document']['list']['items'][number];

function toDocumentListItem(item: DocumentListOutputItem): DocumentListItem {
  return {
    id: item.id,
    originalFileName: item.originalFileName,
    mimeType: item.mimeType,
    fileSizeBytes: Number(item.fileSizeBytes),
    virusScanStatus: item.virusScanStatus,
    createdAt: item.createdAt,
    uploadedByUserId: item.uploadedByUserId,
    status: item.status,
  };
}

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

  const documents = (documentsQuery.data?.items ?? []).map(toDocumentListItem);

  return {
    documents,
    isLoading: documentsQuery.isLoading,
    isEmpty: !documentsQuery.isLoading && documents.length === 0,
    onUploadNewVersion,
  };
}

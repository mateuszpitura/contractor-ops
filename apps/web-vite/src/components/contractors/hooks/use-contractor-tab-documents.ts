import type { AppRouter } from '@contractor-ops/api';
import type { inferRouterOutputs } from '@trpc/server';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { DocumentListItem } from '../../documents/types.js';

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

export function useContractorTabDocuments(contractorId: string) {
  const trpc = useTRPC();

  const documentsQuery = useQuery(
    trpc.document.list.queryOptions({
      entityType: 'CONTRACTOR',
      entityId: contractorId,
      page: 1,
      pageSize: 50,
    }),
  );

  const documents = (documentsQuery.data?.items ?? []).map(toDocumentListItem);

  return {
    contractorId,
    documents,
    isLoading: documentsQuery.isLoading,
  } as const;
}

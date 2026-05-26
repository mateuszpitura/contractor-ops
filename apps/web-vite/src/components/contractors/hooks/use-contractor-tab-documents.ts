import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { DocumentListItem } from '../../documents/types.js';

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

  const documents = (documentsQuery.data?.items ?? []) as unknown as DocumentListItem[];

  return {
    contractorId,
    documents,
    isLoading: documentsQuery.isLoading,
  } as const;
}

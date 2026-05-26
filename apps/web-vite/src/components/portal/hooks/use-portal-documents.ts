import { useQuery } from '@tanstack/react-query';

import { usePortalTRPC } from '../../../providers/trpc-provider.js';

export function usePortalDocuments() {
  const trpc = usePortalTRPC();
  const documentsQuery = useQuery(trpc.portal.listDocuments.queryOptions());

  return {
    documents: documentsQuery.data,
    isLoading: documentsQuery.isPending,
  } as const;
}
